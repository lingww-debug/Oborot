import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { getD1 } from "../db";
import {
  CHANNELS, DEFAULT_SETTINGS, LEGACY_TEXT, SAMPLE_PRODUCTS, TEXT_GROUPS, channelKeys,
  isCategory, isPalette, samplePhoto,
  type Channel, type Contacts, type Product, type PublicSettings, type SiteSettings,
} from "./content";

export class SiteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getAdmin() {
  const ownerEmail = env.SITE_ADMIN_EMAIL?.trim().toLowerCase();
  const user = await getChatGPTUser();
  return ownerEmail && user?.email.toLowerCase() === ownerEmail ? user : null;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== new URL(request.url).origin || (fetchSite && fetchSite !== "same-origin")) {
    throw new SiteError(403, "Откройте форму непосредственно на сайте.");
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(data, { ...init, headers });
}

export function respondError(error: unknown) {
  if (error instanceof SiteError) return json({ error: error.message }, { status: error.status });
  console.error("Site request failed", error);
  return json({ error: "Не удалось выполнить действие. Попробуйте ещё раз." }, { status: 500 });
}

export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new SiteError(415, "Неверный формат запроса.");
  }
  if (Number(request.headers.get("content-length")) > 80_000) {
    throw new SiteError(413, "Запрос слишком большой.");
  }
  const text = await request.text();
  if (text.length > 80_000) throw new SiteError(413, "Запрос слишком большой.");
  try {
    return asObject(JSON.parse(text));
  } catch {
    throw new SiteError(400, "Не удалось прочитать запрос.");
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SiteError(400, "Проверьте поля формы.");
  }
  return value as Record<string, unknown>;
}

export function formText(value: unknown, label: string, max: number, required = true) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    const suffix = required ? "Заполните поле" : "Проверьте поле";
    throw new SiteError(400, suffix + " «" + label + "» (до " + max + " символов).");
  }
  return value.trim();
}

type ContentRow = { document: string; revision: number };
type ProductRow = Omit<Product, "published" | "demo" | "photoUrl" | "photoKey" | "category"> & {
  published: 0 | 1;
  demo: 0 | 1;
  photo_key: string | null;
  category: string;
};

function readProduct(row: ProductRow): Product {
  const { photo_key: photoKey, category, published, demo, ...rest } = row;
  return {
    ...rest, published: Boolean(published), demo: Boolean(demo), photoKey,
    category: isCategory(category) ? category : "Другая техника",
    photoUrl: photoKey ? "/media/" + photoKey : demo ? samplePhoto(row.id) : null,
  };
}

export async function getSettings() {
  const row = await getD1().prepare("SELECT document, revision FROM site_content WHERE id = 1").first<ContentRow>();
  return settingsFromRow(row);
}

function settingsFromRow(row: ContentRow | null) {
  const data = row ? JSON.parse(row.document) as Partial<SiteSettings> : DEFAULT_SETTINGS;
  const text = { ...DEFAULT_SETTINGS.text, ...data.text };
  for (const key of Object.keys(LEGACY_TEXT) as (keyof typeof text)[]) {
    if (text[key] === LEGACY_TEXT[key]) text[key] = DEFAULT_SETTINGS.text[key];
  }
  return {
    revision: row?.revision ?? 0,
    settings: {
      palette: data.palette ?? DEFAULT_SETTINGS.palette,
      text,
      contacts: { ...DEFAULT_SETTINGS.contacts, ...data.contacts },
      faq: data.faq ?? DEFAULT_SETTINGS.faq,
    } satisfies SiteSettings,
  };
}

const productColumns = "id, title, category, spec, condition, description, price, published, demo, photo_key, revision";

async function readStore(admin: boolean) {
  const db = getD1();
  const query = admin
    ? "SELECT " + productColumns + " FROM products ORDER BY demo ASC, updated_at DESC, id ASC"
    : "SELECT " + productColumns + " FROM products WHERE published = 1 ORDER BY demo ASC, updated_at DESC, id ASC";
  const [content, items] = await db.batch([
    db.prepare("SELECT document, revision FROM site_content WHERE id = 1"),
    db.prepare(query),
  ]);
  const row = content.results[0] as ContentRow | undefined;
  return {
    ...settingsFromRow(row ?? null),
    products: row ? (items.results as ProductRow[]).map(readProduct) : SAMPLE_PRODUCTS,
  };
}

export async function readPublicSite() {
  const { settings, products } = await readStore(false);
  const { contacts, ...publicSettings } = settings;
  return {
    products,
    settings: {
      ...publicSettings,
      hasPhone: Boolean(contacts.phone),
      channels: channelKeys.filter((id) => contacts[id]).map((id) => ({
        id, protected: linkIncludesNumber(id, contacts[id]),
      })),
    } satisfies PublicSettings,
  };
}

export async function readAdminSite() {
  const store = await readStore(true);
  if (store.revision) return store;

  const db = getD1();
  const orderedStart = Date.now();
  const sampleWrites = SAMPLE_PRODUCTS.map((p, position) => db.prepare(
    "INSERT OR IGNORE INTO products (" + productColumns + ", updated_at) " +
    "SELECT ?, ?, ?, ?, ?, ?, ?, 1, 1, NULL, 1, ? WHERE NOT EXISTS (SELECT 1 FROM site_content WHERE id = 1)",
  ).bind(p.id, p.title, p.category, p.spec, p.condition, p.description, p.price, orderedStart - position));
  await db.batch([
    ...sampleWrites,
    db.prepare("INSERT OR IGNORE INTO site_content (id, document, revision) VALUES (1, ?, 1)")
      .bind(JSON.stringify(DEFAULT_SETTINGS)),
  ]);
  return readStore(true);
}

const contactHosts: Record<Channel, string[]> = {
  telegram: ["t.me", "telegram.me"],
  whatsapp: ["wa.me", "api.whatsapp.com", "chat.whatsapp.com", "www.whatsapp.com"],
  max: ["max.ru"],
  vk: ["vk.me", "vk.com", "m.vk.com"],
};

function normalizeContactLink(channel: Channel, value: unknown) {
  const link = formText(value, CHANNELS[channel].label, 400, false);
  if (!link) return "";
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new SiteError(400, "Укажите полную ссылку для " + CHANNELS[channel].label + ".");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port
      || !contactHosts[channel].includes(url.hostname) || url.pathname === "/") {
    throw new SiteError(400, "Проверьте ссылку на чат в " + CHANNELS[channel].label + ".");
  }
  return url.href;
}

function normalizePhone(value: unknown) {
  const phone = formText(value, "Телефон", 36, false);
  if (!phone) return "";
  if (!/^\+?[\d ()-]+$/.test(phone)) throw new SiteError(400, "Укажите номер телефона с кодом страны.");
  let digits = phone.replace(/\D/g, "");
  if (!phone.startsWith("+") && digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }
  if (digits.length < 10 || digits.length > 15 || digits.startsWith("0")) {
    throw new SiteError(400, "Укажите номер телефона с кодом страны.");
  }
  return "+" + digits;
}

export function linkIncludesNumber(channel: Channel, link: string) {
  const url = new URL(link);
  const path = url.pathname.replace(/%2b|%3[0-9]/gi, (escape) => decodeURIComponent(escape));
  if (url.searchParams.has("phone") || /(?:^|\/)\+\d{7,}(?:\/|$)/.test(path)) return true;
  return channel === "whatsapp" && /(?:^|\/)\d{7,}(?:\/|$)/.test(path);
}

export function displayPhone(number: string) {
  return number.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, "+7 ($1) $2-$3-$4");
}

function validateContacts(value: unknown): Contacts {
  const data = asObject(value);
  const contacts = { ...DEFAULT_SETTINGS.contacts, phone: normalizePhone(data.phone) };
  for (const id of channelKeys) contacts[id] = normalizeContactLink(id, data[id]);
  return contacts;
}

function validateCopy(value: unknown) {
  const data = asObject(value);
  const text = { ...DEFAULT_SETTINGS.text };
  const input = asObject(data.text);
  for (const group of TEXT_GROUPS) {
    for (const [key, label, , max] of group.fields) {
      const required = !["location", "hours", "heroLabel", "heroAccent"].includes(key);
      text[key] = formText(input[key], label, max, required);
    }
  }
  if (!Array.isArray(data.faq) || data.faq.length > 12) {
    throw new SiteError(400, "Можно добавить до 12 вопросов.");
  }
  const faq = data.faq.map((item) => {
    const question = asObject(item);
    return {
      question: formText(question.question, "Вопрос", 160),
      answer: formText(question.answer, "Ответ", 900),
    };
  });
  return { text, faq };
}

export async function saveSettings(data: Record<string, unknown>) {
  const current = await getSettings();
  const conflict = "Настройки изменились в другом окне. Обновите админку перед сохранением.";
  if (data.revision !== current.revision || !current.revision) throw new SiteError(409, conflict);

  const settings = { ...current.settings };
  if (data.section === "contacts") settings.contacts = validateContacts(data.value);
  else if (data.section === "copy") Object.assign(settings, validateCopy(data.value));
  else if (data.section === "palette" && isPalette(data.value)) settings.palette = data.value;
  else throw new SiteError(400, "Выберите доступный раздел настроек.");

  const updated = await getD1().prepare(
    "UPDATE site_content SET document = ?, revision = revision + 1 WHERE id = 1 AND revision = ? RETURNING revision",
  ).bind(JSON.stringify(settings), current.revision).first<{ revision: number }>();
  if (!updated) throw new SiteError(409, conflict);
  return { settings, revision: updated.revision };
}

const imageKeyPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/;
const productIdPattern = /^(?:[a-f0-9-]{36}|sample-[a-z0-9]+)$/;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

function getBucket() {
  if (!env.BUCKET) throw new SiteError(503, "Хранилище фотографий временно недоступно.");
  return env.BUCKET;
}

async function uploadPhoto(file: File) {
  if (file.size > MAX_PHOTO_BYTES) throw new SiteError(413, "Фотография должна занимать до 6 МБ.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const matches = (offset: number, magic: number[]) => magic.every((b, i) => bytes[offset + i] === b);
  let extension = "";
  let mime = "";
  if (matches(0, [0xff, 0xd8, 0xff]) && file.type === "image/jpeg") {
    extension = "jpg";
    mime = "image/jpeg";
  } else if (matches(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && file.type === "image/png") {
    extension = "png";
    mime = "image/png";
  } else if (matches(0, [82, 73, 70, 70]) && matches(8, [87, 69, 66, 80]) && file.type === "image/webp") {
    extension = "webp";
    mime = "image/webp";
  } else {
    throw new SiteError(400, "Выберите фотографию в формате JPG, PNG или WebP.");
  }
  const key = crypto.randomUUID() + "." + extension;
  await getBucket().put(key, bytes, { httpMetadata: { contentType: mime } });
  return key;
}

async function removePhoto(key: string | null) {
  if (!key) return;
  try {
    await getBucket().delete(key);
  } catch {
    console.warn("Photo cleanup failed");
  }
}

async function findProduct(id: string) {
  const row = await getD1().prepare("SELECT " + productColumns + " FROM products WHERE id = ?")
    .bind(id).first<ProductRow>();
  if (!row) throw new SiteError(404, "Товар уже удалён.");
  return row;
}

const productConflict = "Товар изменился в другом окне. Обновите админку перед сохранением.";

function assertRevision(row: ProductRow, revision: unknown) {
  if (row.revision !== revision) throw new SiteError(409, productConflict);
}

export async function saveProduct(form: FormData) {
  const rawId = form.get("id");
  if (rawId && (typeof rawId !== "string" || !productIdPattern.test(rawId))) {
    throw new SiteError(400, "Проверьте номер карточки.");
  }
  const id = rawId ? String(rawId) : crypto.randomUUID();
  const current = rawId ? await findProduct(id) : null;
  if (current) assertRevision(current, Number(form.get("revision")));

  const title = formText(form.get("title"), "Название", 100);
  const category = formText(form.get("category"), "Категория", 30);
  if (!isCategory(category)) throw new SiteError(400, "Выберите категорию из списка.");
  const spec = formText(form.get("spec"), "Характеристики", 160, false);
  const condition = formText(form.get("condition"), "Состояние", 90);
  const description = formText(form.get("description"), "Описание", 1500, false);
  const rawPrice = formText(form.get("price"), "Цена", 9);
  const price = Number(rawPrice);
  if (!/^\d+$/.test(rawPrice) || price < 1 || price > 999_999_999) {
    throw new SiteError(400, "Укажите целую цену в рублях.");
  }
  const published = form.get("published") === "1" ? 1 : 0;
  const demo = form.get("demo") === "1" ? 1 : 0;
  const photo = form.get("photo");
  const newKey = photo instanceof File && photo.size ? await uploadPhoto(photo) : null;
  const oldKey = current?.photo_key ?? null;
  const photoKey = newKey ?? (form.get("removePhoto") === "1" ? null : oldKey);
  const fields = [title, category, spec, condition, description, price, published, demo, photoKey, Date.now()];
  const db = getD1();

  let row: ProductRow | null;
  try {
    row = current
      ? await db.prepare("UPDATE products SET title=?, category=?, spec=?, condition=?, description=?, price=?, " +
          "published=?, demo=?, photo_key=?, updated_at=?, revision=revision+1 WHERE id=? AND revision=? RETURNING " +
          productColumns).bind(...fields, id, current.revision).first<ProductRow>()
      : await db.prepare("INSERT INTO products (" + productColumns + ", updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?) RETURNING " + productColumns).bind(id, ...fields).first<ProductRow>();
    if (!row) throw new SiteError(409, productConflict);
  } catch (error) {
    await removePhoto(newKey);
    throw error;
  }
  if (oldKey !== photoKey) await removePhoto(oldKey);
  return readProduct(row);
}

export async function changeProduct(action: "delete" | "visibility", data: Record<string, unknown>) {
  if (typeof data.id !== "string" || !productIdPattern.test(data.id)) {
    throw new SiteError(400, "Проверьте номер карточки.");
  }
  const db = getD1();
  const product = await findProduct(data.id);
  assertRevision(product, data.revision);
  if (action === "delete") {
    const row = await db.prepare("DELETE FROM products WHERE id=? AND revision=? RETURNING photo_key")
      .bind(product.id, product.revision).first<{ photo_key: string | null }>();
    if (!row) throw new SiteError(409, productConflict);
    await removePhoto(row.photo_key);
    return { id: product.id };
  }
  if (typeof data.published !== "boolean") throw new SiteError(400, "Выберите видимость товара.");
  const row = await db.prepare("UPDATE products SET published=?, revision=revision+1 WHERE id=? AND revision=? RETURNING " +
    productColumns).bind(Number(data.published), product.id, product.revision).first<ProductRow>();
  if (!row) throw new SiteError(409, productConflict);
  return { product: readProduct(row) };
}

export async function getPhoto(key: string) {
  if (!imageKeyPattern.test(key)) return null;
  const row = await getD1().prepare("SELECT published FROM products WHERE photo_key=?")
    .bind(key).first<{ published: number }>();
  if (!row || (!row.published && !await getAdmin())) return null;
  return getBucket().get(key);
}
