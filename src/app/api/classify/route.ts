import { OPTIONS } from "@/config/decision";
import { classifyImageDataUri, serviceInfo, SystemOneError } from "@/lib/systemone";

// The API key stays on the server; the browser only ever talks to this route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A cold hosted GPU can take about a minute before the first answer.
export const maxDuration = 180;

const MAX_BODY_BYTES = 13_000_000; // a 896px JPEG as base64 is well under 1 MB; this is a hard ceiling
const IMAGE_URI = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

// A small in-memory rate limit. The website is public and every request
// spends the deployment's shared Circuit quota (the free tier is 60 questions
// a minute across the website and the bot), so one visitor must not be able
// to burn it, or to run up a bill on a paid key. Per instance, which is what
// we have: one or two App Runner instances.
const PER_IP_PER_MINUTE = 10;
const GLOBAL_PER_MINUTE = 40;
const buckets = new Map<string, number[]>();

function rateLimited(ip: string): number | null {
  const now = Date.now();
  const cutoff = now - 60_000;
  for (const [key, times] of buckets) {
    const kept = times.filter((t) => t > cutoff);
    if (kept.length) buckets.set(key, kept);
    else buckets.delete(key);
  }
  const mine = buckets.get(ip) ?? [];
  const all = buckets.get("*") ?? [];
  if (mine.length >= PER_IP_PER_MINUTE || all.length >= GLOBAL_PER_MINUTE) {
    const oldest = Math.min(...(mine.length >= PER_IP_PER_MINUTE ? mine : all));
    return Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
  }
  buckets.set(ip, [...mine, now]);
  buckets.set("*", [...all, now]);
  return null;
}

function clientIp(request: Request): string {
  // App Runner and most proxies set X-Forwarded-For; the first entry is the client.
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

class BodyTooLarge extends Error {}

/** Read a JSON body without buffering more than `max` bytes, whatever Content-Length claims. */
async function readJson(request: Request, max: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new BodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > max) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function GET() {
  return Response.json(serviceInfo());
}

export async function POST(request: Request) {
  const retryAfter = rateLimited(clientIp(request));
  if (retryAfter !== null) {
    return Response.json({ error: `Too many requests. Try again in ${retryAfter}s.` }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  let body: { image?: unknown; order?: unknown };
  try {
    body = (await readJson(request, MAX_BODY_BYTES)) as typeof body;
  } catch (e) {
    if (e instanceof BodyTooLarge) return Response.json({ error: "image is too large" }, { status: 413 });
    return Response.json({ error: 'body must be JSON: {"image": "data:image/..."}' }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: 'body must be JSON: {"image": "data:image/..."}' }, { status: 400 });
  }

  const image = body.image;
  if (typeof image !== "string" || !IMAGE_URI.test(image)) {
    return Response.json({ error: "image must be a base64 data URI (png, jpeg, webp or gif)" }, { status: 400 });
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
      // Pass the upstream status through for the UI, but never a 5xx body we didn't write.
      return Response.json({ error: e.message, status: e.status, detail: e.detail }, { status: e.status >= 400 ? e.status : 502 });
    }
    console.error("classify failed:", e);
    return Response.json({ error: "unexpected error while classifying" }, { status: 500 });
  }
}
