import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { Brand } from "../brand";
import { getAdmin, readAdminSite } from "../../lib/site-server";
import { AdminConsole } from "./console";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Админка — ОБОРОТ",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!await getAdmin()) {
    const user = await getChatGPTUser();
    return <div className="admin-shell admin-auth">
      <Brand />
      <h1>{user ? "Админка доступна владельцу" : "Вход в админку"}</h1>
      <p>{user ? "Откройте сайт под аккаунтом владельца, чтобы редактировать товары и настройки." : "Войдите в ChatGPT под аккаунтом, с которого создан сайт."}</p>
      <a className="button primary" href={chatGPTSignInPath("/admin")} target="_top">Войти через ChatGPT ↗</a>
    </div>;
  }
  return <AdminConsole initial={await readAdminSite()} />;
}
