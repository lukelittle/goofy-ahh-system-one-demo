import { OPTIONS } from "@/config/decision";
import { classifyImageDataUri, serviceInfo, SystemOneError } from "@/lib/systemone";

// The API key stays on the server; the browser only ever talks to this route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A cold hosted GPU can take about a minute before the first answer.
export const maxDuration = 180;

const MAX_IMAGE_CHARS = 12_000_000; // ~9 MB of base64; the client resizes long before this
const IMAGE_URI = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export async function GET() {
  return Response.json(serviceInfo());
}

export async function POST(request: Request) {
  let body: { image?: unknown; order?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: {\"image\": \"data:image/...\"}" }, { status: 400 });
  }

  const image = body.image;
  if (typeof image !== "string" || !IMAGE_URI.test(image)) {
    return Response.json({ error: "image must be a base64 data URI (png, jpeg, webp or gif)" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return Response.json({ error: "image is too large" }, { status: 413 });
  }

  // Optional: the same options in a different order (Nerd Mode's order check).
  // Must be a permutation of the configured ids: the client cannot add choices.
  let order: string[] | undefined;
  if (body.order !== undefined) {
    const ids = OPTIONS.map((o) => o.id);
    const o = body.order;
    if (!Array.isArray(o) || o.length !== ids.length || [...o].sort().join() !== [...ids].sort().join()) {
      return Response.json({ error: "order must be a permutation of the configured options" }, { status: 400 });
    }
    order = o as string[];
  }

  try {
    return Response.json(await classifyImageDataUri(image, order));
  } catch (e) {
    if (e instanceof SystemOneError) {
      return Response.json({ error: e.message, status: e.status, detail: e.detail }, { status: e.status >= 400 ? e.status : 502 });
    }
    return Response.json({ error: `unexpected error: ${String(e)}` }, { status: 500 });
  }
}
