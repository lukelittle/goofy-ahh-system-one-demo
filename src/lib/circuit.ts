import { DEFAULT_MODEL, OPTIONS, QUESTION, QUESTION_ID } from "@/config/decision";
import type { ChoiceAnswer, ChoiceQuestion, DecisionResult, ServiceInfo, SystemOneRequest, SystemOneResponse } from "./types";

/**
 * The integration with Circuit-VL. Shared by the Next.js route (through
 * ./systemone, which adds the server-only guard) and the Discord bot.
 *
 * WHAT THIS DOES NOT DO, ON PURPOSE:
 *   - no prompt asking a model to "respond with one of ...", no JSON-mode,
 *     no parsing of generated text;
 *   - no caption step, no second model.
 *
 * WHAT IT DOES: one HTTP request in the System One format. The image is the
 * `state`; our four archetypes are the `criteria` of one `choice` question.
 * The server renders every option between delimiter tokens, runs a single
 * forward pass (Qwen3-VL vision encoder + LoRA-adapted language model), reads
 * the hidden state at each option's closing delimiter and at the final
 * decide token, and the pointer head turns each (decide, option) pair into a
 * score. Softmax over those scores is the `probabilities` object we get back.
 * `output_tokens` in the response is 0: nothing was generated.
 *
 * Contract: `POST /v1/systemone` as implemented by s1proto/service.py in
 * https://github.com/Barneyjm/circuit and used by the decision-circuits SDK
 * (`SystemOne` backend, `Image` media state).
 */

const HOSTED_URL = "https://api.decisioncircuits.com/v1/systemone";

/** Statuses the official SDK retries: rate limited, or a scale-to-zero GPU still starting. */
const RETRY_STATUSES = new Set([429, 502, 503, 504, 524]);
/** The hosted model can take about a minute to cold start; the SDK keeps retrying for 240 s. */
const RETRY_FOR_MS = 150_000;
const REQUEST_TIMEOUT_MS = 120_000;

export function serviceConfig() {
  const url = process.env.CIRCUIT_URL?.trim() || HOSTED_URL;
  const model = process.env.CIRCUIT_MODEL?.trim() || DEFAULT_MODEL;
  const apiKey = process.env.CIRCUIT_API_KEY?.trim() || "";
  const mock = process.env.CIRCUIT_MOCK === "1";
  return { url, model, apiKey, mock };
}

export function serviceInfo(): ServiceInfo {
  const c = serviceConfig();
  return {
    mode: c.mock ? "mock" : c.url === HOSTED_URL ? "hosted" : "custom",
    endpoint: c.url,
    model: c.model,
    hasApiKey: Boolean(c.apiKey),
  };
}

/**
 * The question, exactly as it goes over the wire. The option order is
 * explicit because it is part of the model's input sequence (the author
 * measured small order effects; see the README's Limitations).
 */
export function buildQuestion(order: string[] = OPTIONS.map((o) => o.id)): ChoiceQuestion {
  const criteria: Record<string, string> = {};
  for (const id of order) {
    const opt = OPTIONS.find((o) => o.id === id);
    if (!opt) throw new Error(`unknown option ${id}`);
    criteria[opt.id] = opt.description;
  }
  return { type: "choice", instructions: QUESTION, criteria };
}

export function buildRequest(imageDataUri: string, model: string, order?: string[]): SystemOneRequest {
  return {
    // A media state is {"image": <data URI or URL>, "text"?: caption}. We send
    // no caption, so the server uses its default "See the image."
    state: { image: imageDataUri },
    model,
    questions: { [QUESTION_ID]: buildQuestion(order) },
  };
}

export class SystemOneError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(message);
  }
}

function shortenDataUri(uri: string): string {
  if (!uri.startsWith("data:")) return uri;
  const comma = uri.indexOf(",");
  return `${uri.slice(0, comma + 1)}${uri.slice(comma + 1, comma + 33)}… (${uri.length.toLocaleString()} chars)`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postWithRetry(url: string, body: SystemOneRequest, apiKey: string) {
  const deadline = Date.now() + RETRY_FOR_MS;
  let wait = 5_000;
  let attempts = 0;
  for (;;) {
    attempts += 1;
    let res: Response | null = null;
    let networkError: unknown = null;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "goofy-ahh-system-one-demo",
          // The contract always requires a bearer token. A local circuit server
          // without S1_API_KEY accepts any non-empty token.
          Authorization: `Bearer ${apiKey || "local"}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (e) {
      networkError = e;
    }
    const status = res ? res.status : 504;
    if (res && !RETRY_STATUSES.has(status)) return { res, attempts };
    const retryAfter = Number(res?.headers.get("retry-after")) * 1000 || 0;
    const pause = Math.max(wait, retryAfter);
    if (Date.now() + pause > deadline) {
      if (res) return { res, attempts };
      throw new SystemOneError(`could not reach ${url}: ${String(networkError)}`, 504);
    }
    await sleep(pause);
    wait = Math.min(wait * 1.5, 30_000);
  }
}

/**
 * Check the answer is what the contract promises before the UI shows it. If
 * anything is off we fail loudly rather than display numbers we cannot vouch for.
 */
function validateAnswer(answer: unknown, expected: string[]): ChoiceAnswer {
  const a = answer as Partial<ChoiceAnswer> | undefined;
  if (!a || a.type !== "choice" || typeof a.choice !== "string" || !a.probabilities) {
    throw new SystemOneError("response has no choice answer for our question", 502, answer);
  }
  const keys = Object.keys(a.probabilities).sort();
  if (keys.join("|") !== [...expected].sort().join("|")) {
    throw new SystemOneError(`answer options ${keys.join(", ")} do not match the options we sent`, 502, answer);
  }
  const values = Object.values(a.probabilities);
  if (values.some((p) => typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1)) {
    throw new SystemOneError("answer has a probability outside [0, 1]", 502, answer);
  }
  const sum = values.reduce((x, y) => x + y, 0);
  if (Math.abs(sum - 1) > 1e-3) {
    throw new SystemOneError(`probabilities sum to ${sum}, not 1`, 502, answer);
  }
  return a as ChoiceAnswer;
}

const INTERESTING_HEADERS = ["x-s1-latency-ms", "x-request-id", "x-s1-input-tokens", "x-circuit-model", "x-circuit-served-by", "x-circuit-rate"];

export async function classifyImageDataUri(imageDataUri: string, order?: string[]): Promise<DecisionResult> {
  const cfg = serviceConfig();
  const optionOrder = order ?? OPTIONS.map((o) => o.id);
  const body = buildRequest(imageDataUri, cfg.model, optionOrder);
  const loggedRequest = { ...body, state: { ...body.state, image: shortenDataUri(body.state.image) } };

  if (cfg.mock) {
    const { mockAnswer } = await import("./mock");
    return mockAnswer(imageDataUri, optionOrder, loggedRequest, cfg.model);
  }
  if (!cfg.apiKey && cfg.url === HOSTED_URL) {
    throw new SystemOneError("CIRCUIT_API_KEY is not set. Get a free key at https://decisioncircuits.com/#api and put it in .env.local.", 500);
  }

  const t0 = performance.now();
  const { res, attempts } = await postWithRetry(cfg.url, body, cfg.apiKey);
  const latencyMs = performance.now() - t0;

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new SystemOneError(`System One server returned ${res.status} with a non-JSON body`, res.status, text.slice(0, 500));
  }
  if (!res.ok) {
    throw new SystemOneError(`System One server returned ${res.status}`, res.status, json);
  }

  const resp = json as SystemOneResponse;
  const answer = validateAnswer(resp.answers?.[QUESTION_ID], optionOrder);

  const headers: Record<string, string> = {};
  for (const h of INTERESTING_HEADERS) {
    const v = res.headers.get(h);
    if (v) headers[h] = v;
  }
  const serverLatency = Number(headers["x-s1-latency-ms"]);

  return {
    choice: answer.choice,
    probabilities: answer.probabilities,
    confidence: answer.confidence,
    latencyMs,
    serverLatencyMs: Number.isFinite(serverLatency) && serverLatency > 0 ? serverLatency : null,
    attempts,
    model: resp.model ?? headers["x-circuit-model"] ?? cfg.model,
    requestedModel: cfg.model,
    endpoint: cfg.url,
    requestId: resp.request_id ?? headers["x-request-id"] ?? null,
    inputTokens: resp.usage?.input_tokens ?? null,
    outputTokens: resp.usage?.output_tokens ?? null,
    optionOrder,
    request: loggedRequest,
    raw: json,
    headers,
    mock: false,
  };
}
