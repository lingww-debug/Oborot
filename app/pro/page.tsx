import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { proSession, readPro } from "../../lib/pro-server";
import { ProWorkspace } from "./workspace";
import "./pro.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {title:"Кабинет скупа — ОБОРОТ",robots:{index:false,follow:false}};
export default async function ProPage() {
  const session = await proSession();
  if (!session) { const user = await getChatGPTUser(); return <main className="pro-shell pro-gate"><a href="/" className="pro-brand">ОБОРОТ <small>для партнёров</small></a><span className="pro-eyebrow">Закрытый кабинет</span><h1>Выгода начинается<br/>с точного расчёта.</h1><p>{user ? "Для этого аккаунта нет действующего доступа. Владелец выдаёт доступ после согласования условий. Онлайн-оплата пока не подключена." : "Войдите через ChatGPT. Кабинет доступен владельцу и партнёрам с действующим доступом."}</p><a className="pro-button" href={chatGPTSignInPath("/pro")} target="_top">Войти через ChatGPT ↗</a><a className="pro-text-link" href="/#contacts">Связаться с ОБОРОТ</a></main>; }
  return <ProWorkspace initial={await readPro(session)}/>;
}
