import { challenge, readTarget, reveal } from "../../../lib/contact-server";
import { assertSameOrigin, readJson, respondError, SiteError } from "../../../lib/site-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const data = await readJson(request);
    const target = readTarget(data.target);
    if (data.action === "challenge") return await challenge(request, target);
    if (data.action === "reveal") return await reveal(request, target, data);
    throw new SiteError(400, "Проверьте выбранное действие.");
  } catch (error) {
    return respondError(error);
  }
}
