import "server-only";

import { createHash } from "node:crypto";

import type { DecisionResult } from "./types";

/**
 * MOCK MODE (CIRCUIT_MOCK=1) — for working on the UI offline. NOT A MODEL.
 *
 * The numbers are a hash of the image bytes pushed through a softmax. They
 * mean nothing. Every result carries `mock: true`, the model name says MOCK,
 * and the UI shows a banner over the result. Never present these as
 * Circuit-VL output.
 */
export function mockAnswer(imageDataUri: string, order: string[], request: unknown, model: string): DecisionResult {
  const digest = createHash("sha256").update(imageDataUri).digest();
  const logits = order.map((_, i) => (digest[i] / 255) * 4);
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const z = exps.reduce((a, b) => a + b, 0);
  const probabilities: Record<string, number> = {};
  order.forEach((id, i) => (probabilities[id] = exps[i] / z));
  const choice = order.reduce((a, b) => (probabilities[a] >= probabilities[b] ? a : b));
  const ps = Object.values(probabilities);
  const h = -ps.reduce((acc, p) => acc + p * Math.log(p), 0);
  return {
    choice,
    probabilities,
    confidence: 1 - h / Math.log(ps.length),
    latencyMs: 0,
    serverLatencyMs: null,
    attempts: 0,
    model: "MOCK — not Circuit-VL",
    requestedModel: model,
    endpoint: "(mock: no request was sent)",
    requestId: null,
    inputTokens: null,
    outputTokens: null,
    optionOrder: order,
    request,
    raw: { mock: true, note: "CIRCUIT_MOCK=1: hash of the image bytes, not a model output" },
    headers: {},
    mock: true,
  };
}
