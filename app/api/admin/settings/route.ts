import { assertSameOrigin, getAdmin, json, readJson, respondError, saveSettings, SiteError } from "../../../../lib/site-server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    if (!await getAdmin()) throw new SiteError(403, "Войдите в аккаунт владельца сайта.");
    assertSameOrigin(request);
    return json(await saveSettings(await readJson(request)));
  } catch (error) {
    return respondError(error);
  }
}
