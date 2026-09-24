import type { ClassifyError, DecisionResult } from "./types";

/**
 * Downscale in the browser before upload. Qwen3-VL turns an image into a
 * number of vision tokens that grows with resolution; a profile picture does
 * not need 12 megapixels to look like a fox. This is our choice, not a model
 * requirement.
 */
const MAX_SIDE = 896;

export async function fileToDataUri(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas is not available");
  ctx.fillStyle = "#ffffff"; // JPEG has no alpha; transparent PNGs get a white background
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}

export class ClassifyFailure extends Error {
  constructor(public info: ClassifyError) {
    super(info.error);
  }
}

/** The one call the UI makes. The server route adapts Circuit's answer to a DecisionResult. */
export async function classifyImage(imageDataUri: string, order?: string[]): Promise<DecisionResult> {
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageDataUri, order }),
  });
  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new ClassifyFailure(json as ClassifyError);
  return json as DecisionResult;
}
