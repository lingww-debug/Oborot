import { openMessenger } from "../../../lib/contact-server";
import { isChannel } from "../../../lib/content";
import { respondError, SiteError } from "../../../lib/site-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ channel: string }> }) {
  try {
    const { channel } = await context.params;
    if (!isChannel(channel)) throw new SiteError(404, "Этот способ связи пока недоступен.");
    const draft = channel === "telegram" ? new URL(request.url).searchParams.get("text") : null;
    return await openMessenger(channel, draft);
  } catch (error) {
    return respondError(error);
  }
}
