import { getPhoto, respondError } from "../../../lib/site-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ image: string }> }) {
  try {
    const { image } = await context.params;
    const photo = await getPhoto(image);
    if (!photo) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(photo.size),
    });
    photo.writeHttpMetadata(headers);
    return new Response(photo.body, { headers });
  } catch (error) {
    return respondError(error);
  }
}
