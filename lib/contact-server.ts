import { env } from "cloudflare:workers";
import { getD1 } from "../db";
import { isChannel, type Channel } from "./content";
import { displayPhone, getSettings, json, linkIncludesNumber, SiteError } from "./site-server";

const COOKIE = "oborot_contact";
const WINDOW_MS = 10 * 60 * 1000;
const CHALLENGE_MS = 2 * 60 * 1000;
const words = ["два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
type Target = "phone" | Channel;

export function readTarget(value: unknown): Target {
  if (value === "phone" || isChannel(value)) return value;
  throw new SiteError(400, "Выберите способ связи.");
}

async function getTarget(target: Target) {
  const { settings } = await getSettings();
  const value = settings.contacts[target];
  if (!value) throw new SiteError(404, "Этот способ связи пока недоступен.");
  return value;
}

export async function openMessenger(channel: Channel, draft?: string | null) {
  const link = await getTarget(channel);
  if (linkIncludesNumber(channel, link)) {
    throw new SiteError(403, "Откройте чат со страницы контактов и пройдите проверку.");
  }
  const destination = new URL(link);
  if (channel === "telegram" && draft) destination.searchParams.set("text", draft.slice(0, 1024));
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.href,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function sessionFromCookie(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  return cookie && /^[a-f0-9-]{36}$/.test(cookie) ? cookie : null;
}

async function anonymousKeys(request: Request, session: string) {
  if (!env.CONTACT_RATE_SALT) throw new SiteError(503, "Проверка временно недоступна.");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(env.CONTACT_RATE_SALT), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = async (value: string) => {
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const network = request.headers.get("cf-connecting-ip");
  const user = request.headers.get("oai-authenticated-user-id");
  return {
    proof: await digest("session:" + session),
    network: await digest(network ? "network:" + network : user ? "user:" + user : "no-network"),
    hasNetwork: Boolean(network || user),
  };
}

async function countRequest(id: string, limit: number, now: number) {
  return getD1().prepare(
    "INSERT INTO contact_limits (id, hits, expires_at) VALUES (?1, 1, ?2) " +
    "ON CONFLICT(id) DO UPDATE SET hits = CASE WHEN expires_at <= ?3 THEN 1 ELSE hits + 1 END, " +
    "expires_at = CASE WHEN expires_at <= ?3 THEN ?2 ELSE expires_at END " +
    "WHERE expires_at <= ?3 OR hits < ?4 RETURNING hits",
  ).bind(id, now + WINDOW_MS, now, limit).first<{ hits: number }>();
}

async function checkLimit(request: Request, session: string, action: string, now: number) {
  const { proof, network, hasNetwork } = await anonymousKeys(request, session);
  const message = "Слишком много запросов. Попробуйте через 10 минут.";
  if (!await countRequest(action + ":browser:" + proof, 12, now)) throw new SiteError(429, message);
  if (!await countRequest(action + ":network:" + network, hasNetwork ? 60 : 240, now)) {
    throw new SiteError(429, message);
  }
  return proof;
}

export async function challenge(request: Request, target: Target) {
  const contact = await getTarget(target);
  if (target !== "phone" && !linkIncludesNumber(target, contact)) {
    throw new SiteError(400, "Для этого чата можно перейти по кнопке на сайте.");
  }
  const session = sessionFromCookie(request) ?? crypto.randomUUID();
  const now = Date.now();
  const proof = await checkLimit(request, session, "challenge", now);
  const [a, b, cleanup] = crypto.getRandomValues(new Uint8Array(3));
  const left = a % words.length;
  const right = b % words.length;
  const id = crypto.randomUUID();
  const db = getD1();
  const writes = [db.prepare("INSERT INTO contact_challenges (id, proof, target, answer, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, proof, target, left + right + 4, now + CHALLENGE_MS)];
  if (cleanup % 16 === 0) {
    writes.push(
      db.prepare("DELETE FROM contact_challenges WHERE expires_at <= ?").bind(now),
      db.prepare("DELETE FROM contact_limits WHERE expires_at <= ?").bind(now),
    );
  }
  await db.batch(writes);
  return json({ id, prompt: "Сложите " + words[left] + " и " + words[right] + "." }, {
    headers: { "Set-Cookie": COOKIE + "=" + session + "; Path=/api/contact; Max-Age=1800; HttpOnly; Secure; SameSite=Strict" },
  });
}

export async function reveal(request: Request, target: Target, data: Record<string, unknown>) {
  const session = sessionFromCookie(request);
  if (!session || typeof data.id !== "string" || !/^[a-f0-9-]{36}$/.test(data.id)) {
    throw new SiteError(400, "Получите новый вопрос.");
  }
  const now = Date.now();
  const proof = await checkLimit(request, session, "reveal", now);
  const challengeRow = await getD1().prepare(
    "DELETE FROM contact_challenges WHERE id = ? AND proof = ? AND target = ? AND expires_at > ? RETURNING answer",
  ).bind(data.id, proof, target, now).first<{ answer: number }>();
  if (!challengeRow) throw new SiteError(410, "Время проверки истекло. Получите новый вопрос.");
  if (typeof data.answer !== "string" || !/^\d{1,2}$/.test(data.answer) || Number(data.answer) !== challengeRow.answer) {
    throw new SiteError(422, "Ответ не совпал. Получите новый вопрос.");
  }
  const value = await getTarget(target);
  return json(target === "phone" ? { phone: displayPhone(value), url: "tel:" + value } : { url: value });
}
