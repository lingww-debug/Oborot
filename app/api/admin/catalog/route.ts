import { assertSameOrigin, changeProduct, getAdmin, json, readJson, respondError, saveProduct, SiteError } from "../../../../lib/site-server";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  if (!await getAdmin()) throw new SiteError(403, "Войдите в аккаунт владельца сайта.");
  assertSameOrigin(request);
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      throw new SiteError(415, "Неверный формат карточки.");
    }
    if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024 + 32_000) {
      throw new SiteError(413, "Фотография должна занимать до 6 МБ.");
    }
    return json({ product: await saveProduct(await request.formData()) });
  } catch (error) {
    return respondError(error);
  }
}

async function change(action: "delete" | "visibility", request: Request) {
  try {
    await authorize(request);
    return json(await changeProduct(action, await readJson(request)));
  } catch (error) {
    return respondError(error);
  }
}

export const PATCH = (request: Request) => change("visibility", request);
export const DELETE = (request: Request) => change("delete", request);
