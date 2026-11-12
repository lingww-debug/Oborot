import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { getD1 } from "../db";
import { getAdmin, SiteError, formText } from "./site-server";
import { CHECKLIST, dealMargin, sellerQuestions, money, type ProDeal, type ProPreferences, type ProState } from "./pro-types";

type Session = { userId: string; email: string; admin: boolean; expiresAt: number | null };
export async function proSession(): Promise<Session | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  const admin = Boolean(await getAdmin());
  const access = admin ? null : await getD1().prepare("SELECT expires_at FROM pro_access WHERE email = ?").bind(user.email.toLowerCase()).first<{ expires_at: number }>();
  if (!admin && (!access || access.expires_at <= Date.now())) return null;
  return { userId: user.userId, email: user.email, admin, expiresAt: access?.expires_at ?? null };
}
export async function requirePro() {
  const session = await proSession();
  if (!session) throw new SiteError(403, "Войдите в аккаунт с действующим доступом к кабинету.");
  return session;
}
const defaults: ProPreferences = { region: "", models: "iPhone", budget: 50000, minMargin: 5000 };
export async function readPro(s: Session): Promise<ProState> {
  const db = getD1();
  const [pref, deals, events] = await db.batch([
    db.prepare("SELECT document FROM pro_preferences WHERE user_id=?").bind(s.userId),
    db.prepare("SELECT document FROM pro_deals WHERE user_id=? ORDER BY updated_at DESC LIMIT 200").bind(s.userId),
    db.prepare("SELECT id, deal_id AS dealId, type, message, created_at AS createdAt FROM pro_events WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(s.userId),
  ]);
  const access = s.admin ? await db.prepare("SELECT email, expires_at AS expiresAt FROM pro_access ORDER BY expires_at DESC LIMIT 200").all() : { results: [] };
  return { admin: s.admin, email: s.email, expiresAt: s.expiresAt, telegramReady: s.admin && Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID), preferences: pref.results[0] ? JSON.parse((pref.results[0] as {document:string}).document) : defaults, deals: (deals.results as {document:string}[]).map(r => JSON.parse(r.document)), events: events.results as ProState["events"], access: access.results as ProState["access"] };
}
function event(s: Session, type: string, message: string, dealId: string | null = null) {
  return getD1().prepare("INSERT INTO pro_events (id,user_id,deal_id,type,message,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), s.userId, dealId, type, message, Date.now());
}
function amount(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 10000000) throw new SiteError(400, "Проверьте сумму: " + label);
  return value;
}
function validId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) throw new SiteError(400, "Проверьте карточку.");
}
function avitoUrl(raw: unknown) {
  const text = formText(raw, "Ссылка Авито", 1500);
  let url: URL;
  try { url = new URL(text); } catch { throw new SiteError(400, "Укажите полную ссылку на объявление Авито."); }
  if (url.protocol !== "https:" || !["avito.ru", "www.avito.ru", "m.avito.ru"].includes(url.hostname) || url.username || url.password || url.port || url.pathname === "/") throw new SiteError(400, "Нужна HTTPS-ссылка на объявление avito.ru.");
  return url.href;
}
export async function mutatePro(s: Session, data: Record<string, unknown>) {
  const db = getD1();
  if (data.action === "preferences") {
    const p = data.value as Record<string, unknown> | null;
    if (!p) throw new SiteError(400, "Проверьте настройки.");
    const preferences = { region: formText(p.region, "Регион", 120), models: formText(p.models, "Модели", 500), budget: amount(p.budget, "Бюджет"), minMargin: amount(p.minMargin, "Минимальная маржа") };
    await db.batch([db.prepare("INSERT INTO pro_preferences (user_id,document) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET document=excluded.document").bind(s.userId, JSON.stringify(preferences)), event(s, "preferences", "Сохранены фильтры поиска. Мониторинг не подключён.")]);
  } else if (data.action === "access") {
    if (!s.admin) throw new SiteError(403, "Доступ выдаёт владелец.");
    const email = formText(data.email, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SiteError(400, "Проверьте email.");
    const days = amount(data.days, "Срок доступа");
    if (days > 366) throw new SiteError(400, "Максимум 366 дней. Ноль отзывает доступ.");
    const expiresAt = days ? Date.now() + days * 86400000 : 0;
    await db.batch([db.prepare("INSERT INTO pro_access (email,expires_at) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET expires_at=excluded.expires_at").bind(email, expiresAt), event(s, "access", days ? `Выдан доступ ${email} на ${days} дн.` : `Отозван доступ ${email}`)]);
  } else if (data.action === "save") {
    const d = data.value as Record<string, unknown> | null;
    if (!d) throw new SiteError(400, "Проверьте карточку.");
    const isNew = !d.id;
    const id = isNew ? crypto.randomUUID() : d.id;
    validId(id);
    const current = isNew ? null : await db.prepare("SELECT revision FROM pro_deals WHERE id=? AND user_id=?").bind(id, s.userId).first<{revision: number}>();
    if (!isNew && !current) throw new SiteError(404, "Карточка не найдена.");
    if (current && current.revision !== d.revision) throw new SiteError(409, "Карточка изменена в другом окне. Обновите страницу.");
    const count = isNew ? await db.prepare("SELECT COUNT(*) AS n FROM pro_deals WHERE user_id=?").bind(s.userId).first<{n:number}>() : null;
    if (count && count.n >= 200) throw new SiteError(400, "Достигнут лимит: 200 карточек.");
    const checklist = d.checklist;
    if (!Array.isArray(checklist) || checklist.some(v => typeof v !== "string" || !CHECKLIST.includes(v)) || checklist.length > CHECKLIST.length) throw new SiteError(400, "Проверьте чеклист.");
    const decision = d.decision;
    if (!["review", "visit", "call", "skip"].includes(String(decision))) throw new SiteError(400, "Выберите решение.");
    const deal: ProDeal = { id, title: formText(d.title, "Название", 150), url: avitoUrl(d.url), purchase: amount(d.purchase,"Покупка"), resale: amount(d.resale,"Продажа"), repair: amount(d.repair,"Ремонт"), logistics: amount(d.logistics,"Логистика"), reserve: amount(d.reserve,"Резерв"), defects: formText(d.defects, "Дефекты", 2000, false), notes: formText(d.notes, "Заметки", 4000, false), checklist, decision: decision as ProDeal["decision"], revision: (current?.revision ?? 0) + 1, updatedAt: Date.now() };
    const result = isNew ? await db.prepare("INSERT INTO pro_deals (id,user_id,document,revision,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM pro_deals WHERE user_id=?) < 200").bind(id,s.userId,JSON.stringify(deal),deal.revision,Date.now(),deal.updatedAt,s.userId).run() : await db.prepare("UPDATE pro_deals SET document=?,revision=?,updated_at=? WHERE id=? AND user_id=? AND revision=?").bind(JSON.stringify(deal),deal.revision,deal.updatedAt,id,s.userId,current!.revision).run();
    if (!result.meta.changes) throw new SiteError(409, isNew ? "Достигнут лимит: 200 карточек." : "Карточка изменена. Обновите страницу.");
    await event(s, "deal", `${isNew ? "Добавлена" : "Сохранена"} карточка «${deal.title}». Расчётная маржа: ${money(dealMargin(deal))}. Решение: ${{review:"на проверке",visit:"ехать",call:"позвонить",skip:"пропустить"}[deal.decision]}.`, id).run();
  } else if (data.action === "telegram") {
    if (!s.admin) throw new SiteError(403, "Отправка доступна владельцу.");
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) throw new SiteError(503, "Telegram не подключён. Настройте токен бота и ID чата в секретах сервера.");
    validId(data.id);
    const row = await db.prepare("SELECT document FROM pro_deals WHERE id=? AND user_id=?").bind(data.id, s.userId).first<{document:string}>();
    if (!row) throw new SiteError(404,"Карточка не найдена.");
    const now = Date.now();
    const acquired = await db.prepare("INSERT INTO contact_limits (id,hits,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=1,expires_at=excluded.expires_at WHERE contact_limits.expires_at <= ? RETURNING id").bind("pro:telegram:"+s.userId,now+10000,now).first<{id:string}>();
    if (!acquired) throw new SiteError(429,"Подождите 10 секунд перед следующей отправкой.");
    const deal: ProDeal = JSON.parse(row.document);
    await event(s,"telegram_attempt","Запрошена отправка карточки в Telegram.",deal.id).run();
    const text = [`ОБОРОТ · ${deal.title}`,deal.url,`Покупка: ${money(deal.purchase)}`,`Ожидаемая продажа: ${money(deal.resale)}`,`Ремонт / логистика / резерв: ${money(deal.repair)} / ${money(deal.logistics)} / ${money(deal.reserve)}`,`Расчётная маржа: ${money(dealMargin(deal))}`,`Дефекты: ${deal.defects || "Не указаны — уточнить"}`,`Проверено: ${deal.checklist.join(", ") || "Ничего — требуется осмотр"}`,`Заметки: ${deal.notes || "Нет"}`,"Вопросы продавцу:",...sellerQuestions(deal)].join("\n").slice(0,4000);
    let response: Response;
    try { response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text,link_preview_options:{is_disabled:true}}), signal:AbortSignal.timeout(10000) }); } catch { await event(s,"telegram_error","Telegram не подтвердил доставку. Проверьте чат перед повтором.",deal.id).run(); throw new SiteError(502,"Telegram не подтвердил доставку. Проверьте чат перед повтором."); }
    const payload = await response.json() as {ok?:boolean};
    if (!response.ok || !payload.ok) { await event(s,"telegram_error","Telegram отклонил отправку. Проверьте настройки бота.",deal.id).run(); throw new SiteError(502,"Telegram отклонил отправку. Проверьте токен, ID чата и запуск бота."); }
    await event(s,"telegram","Карточка отправлена в Telegram.",deal.id).run();
  } else throw new SiteError(400,"Неизвестное действие.");
  return readPro(s);
}
