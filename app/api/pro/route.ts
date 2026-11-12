import { requirePro, readPro, mutatePro } from "../../../lib/pro-server";
import { assertSameOrigin, json, readJson, respondError } from "../../../lib/site-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return json(await readPro(await requirePro())); } catch (e) { return respondError(e); }
}
export async function POST(request: Request) {
  try { const session = await requirePro(); assertSameOrigin(request); return json(await mutatePro(session, await readJson(request))); } catch (e) { return respondError(e); }
}
