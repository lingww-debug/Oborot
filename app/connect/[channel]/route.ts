import { openMessenger } from "../../../lib/contact-server";
import { isChannel } from "../../../lib/content";
import { respondError, SiteError } from "../../../lib/site-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ channel: string }> }) {
  try {
    const { channel } = await context.params;
    if (!isChannel(channel)) throw new SiteError(404, "Этот способ связи пока недоступен.");
    return await openMessenger(channel);
  } catch (error) {
    return respondError(error);
  }
}
