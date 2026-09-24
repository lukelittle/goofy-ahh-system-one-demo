/**
 * Wire types for the System One contract (`POST /v1/systemone`), limited to
 * what this demo sends and reads. Source of truth: `s1proto/schema.py` in
 * https://github.com/Barneyjm/circuit (kept byte-compatible with TypeSafe's
 * System One API).
 */

/** An image state: the image is the thing the questions are about. */
export interface ImageState {
  /** A data URI (`data:image/jpeg;base64,...`) or an https URL. */
  image: string;
  /** Optional caption. When absent the server uses "See the image." */
  text?: string;
}

/** A `choice` question: pick exactly one of the named options. */
export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  /** option name -> description (or null). Order is the order the model sees. */
  criteria: Record<string, string | null>;
}

export interface SystemOneRequest {
  state: ImageState;
  model: string;
  questions: Record<string, ChoiceQuestion>;
}

export interface ChoiceAnswer {
  type: "choice";
  /** The argmax of `probabilities`. Chosen by the server, not generated. */
  choice: string;
  /** One probability per option you supplied. Softmax output: sums to 1. */
  probabilities: Record<string, number>;
  /** 1 - H(p) / log(N): 1 when all mass is on one option, 0 when uniform. */
  confidence: number;
}

export interface SystemOneResponse {
  model: string;
  answers: Record<string, ChoiceAnswer>;
  usage: { input_tokens: number; output_tokens: number };
  request_id?: string;
}

/** What the frontend receives from /api/classify. */
export interface DecisionResult {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
  /** Round trip from our server to the System One endpoint, including any cold-start retries. */
  latencyMs: number;
  /** Forward-pass time as reported by the server (`x-s1-latency-ms`), when it reports one. */
  serverLatencyMs: number | null;
  /** How many HTTP attempts it took (a cold GPU answers 502/503 until it is up). */
  attempts: number;
  /** `model` as returned by the server, e.g. a run name with its revision. */
  model: string;
  /** The model name we asked for. */
  requestedModel: string;
  endpoint: string;
  requestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  /** The order the options were sent in. Order matters to the input sequence, so we record it. */
  optionOrder: string[];
  /** The request body we sent, with the image data URI shortened. */
  request: unknown;
  /** The untouched response body. */
  raw: unknown;
  /** Selected response headers (model routing, latency) for Nerd Mode. */
  headers: Record<string, string>;
  /** True only when CIRCUIT_MOCK=1. The UI shows a loud banner: these are NOT model outputs. */
  mock: boolean;
}

export interface ClassifyError {
  error: string;
  status?: number;
  detail?: unknown;
}

export interface ServiceInfo {
  mode: "hosted" | "custom" | "mock";
  endpoint: string;
  model: string;
  hasApiKey: boolean;
}
