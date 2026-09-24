"use client";

import { useState } from "react";

import { OPTIONS, QUESTION } from "@/config/decision";
import { classifyImage, ClassifyFailure } from "@/lib/classifyImage";
import { logScores, pct, sortedEntries } from "@/lib/math";
import type { ChoiceQuestion, DecisionResult } from "@/lib/types";

import SequenceView from "./SequenceView";

function Json({ value }: { value: unknown }) {
  return <pre className="max-h-80 overflow-auto border-2 border-black bg-neutral-50 p-3 font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>;
}

const th = "border-b-2 border-black px-3 py-1.5 text-left text-sm";
const td = "border-b border-neutral-300 px-3 py-1.5";

export default function NerdMode({ image, result }: { image: string; result: DecisionResult }) {
  const [orderCheck, setOrderCheck] = useState<{ status: "idle" | "loading" | "done" | "error"; result?: DecisionResult; error?: string }>({ status: "idle" });

  const req = result.request as { questions?: Record<string, ChoiceQuestion> };
  const question = req.questions ? Object.values(req.questions)[0] : undefined;
  const scores = logScores(result.probabilities);
  const reversed = [...result.optionOrder].reverse();

  const runOrderCheck = async () => {
    setOrderCheck({ status: "loading" });
    try {
      setOrderCheck({ status: "done", result: await classifyImage(image, reversed) });
    } catch (e) {
      setOrderCheck({ status: "error", error: e instanceof ClassifyFailure ? e.info.error : String(e) });
    }
  };

  const rows: [string, React.ReactNode, string?][] = [
    ["selected choice", result.choice, "highest probability, picked by the server"],
    ["confidence", result.confidence.toFixed(3), "1 − H(p)/log N"],
    ["round trip", result.mock ? "none (mock)" : `${Math.round(result.latencyMs)} ms`, result.attempts > 1 ? `${result.attempts} attempts (cold-start retries)` : "this server to the endpoint and back"],
    ["server forward pass", result.serverLatencyMs ? `${result.serverLatencyMs.toFixed(0)} ms` : "not reported", "x-s1-latency-ms header, if forwarded"],
    ["model (as reported)", result.model],
    ["model (requested)", result.requestedModel],
    ["tokens in / out", `${result.inputTokens ?? "?"} / ${result.outputTokens ?? "?"}`, "out is 0: nothing was generated"],
    ["request id", result.requestId ?? "none"],
    ["endpoint", result.endpoint],
    ...Object.entries(result.headers).map(([k, v]) => [k, v] as [string, string]),
  ];

  return (
    <div className="doc space-y-10 border-t-4 border-black pt-6">
      <h3 className="meme text-3xl">Nerd Mode: what actually went over the wire</h3>

      <section className="flex flex-col gap-5 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="h-36 w-36 shrink-0 border-2 border-black object-cover" />
        <dl className="space-y-2">
          <div>
            <dt className="font-bold">state</dt>
            <dd>
              <code>{"{ image: <the JPEG on the left, as a data URI> }"}</code>
            </dd>
          </div>
          <div>
            <dt className="font-bold">question</dt>
            <dd>&ldquo;{QUESTION}&rdquo;</dd>
          </div>
          <div>
            <dt className="font-bold">choices (the only answers that exist, and we wrote them)</dt>
            <dd className="font-mono">{result.optionOrder.join(", ")}</dd>
          </div>
        </dl>
      </section>

      {question && (
        <section>
          <h4 className="mb-2 text-xl font-bold">1. The sequence the model reads, in one forward pass</h4>
          <SequenceView question={question} />
        </section>
      )}

      <section>
        <h4 className="mb-2 text-xl font-bold">2. Scoring: one score per option, then softmax</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse font-mono text-sm">
            <thead>
              <tr>
                <th className={th}>option (ours)</th>
                <th className={th}>score = log p</th>
                <th className={th}>probability</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries(result.probabilities).map(([id, p]) => (
                <tr key={id} className={id === result.choice ? "font-bold" : ""}>
                  <td className={td}>
                    {id}
                    {id === result.choice && " ← chosen"}
                  </td>
                  <td className={`${td} tabular-nums`}>{scores[id].toFixed(3)}</td>
                  <td className={`${td} tabular-nums`}>{pct(p, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          On the server the head computes <code>logit_i = (W_k·h_&lt;/opt_i&gt;) · (W_q·h_&lt;decide&gt;) / √d</code>, divides by a calibrated temperature and applies softmax. The API returns probabilities,
          not logits, so the score column is <code>log p_i</code>: the temperature-scaled logit minus a constant shared by every option. The gaps between rows are exact; the absolute values
          aren&apos;t.
        </p>
      </section>

      <section>
        <h4 className="mb-2 text-xl font-bold">3. The answer and the bookkeeping</h4>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map(([k, v, hint]) => (
              <tr key={k}>
                <td className={`${td} w-48 align-top font-bold`}>{k}</td>
                <td className={`${td} font-mono break-all`}>
                  {v}
                  {hint && <span className="block font-sans text-xs text-neutral-500">{hint}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h4 className="mb-2 text-xl font-bold">4. Does option order matter?</h4>
        <p>
          The options are part of the input sequence, so their order can nudge the scores. The author measured 3.6% of top answers flipping under reordering for circuit-vl-4b v1.1 on their own
          test grid. Ask again with the same options reversed:
        </p>
        <button
          type="button"
          onClick={runOrderCheck}
          disabled={orderCheck.status === "loading"}
          className="mt-3 border-2 border-black px-3 py-1.5 font-bold hover:bg-black hover:text-white disabled:opacity-50"
        >
          {orderCheck.status === "loading" ? "Asking again…" : `Re-ask as [${reversed.join(", ")}]`}
        </button>
        {orderCheck.status === "error" && <p className="mt-3 text-red-700">{orderCheck.error}</p>}
        {orderCheck.status === "done" && orderCheck.result && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse font-mono text-sm">
              <thead>
                <tr>
                  <th className={th}>option</th>
                  <th className={th}>original order</th>
                  <th className={th}>reversed</th>
                  <th className={th}>change</th>
                </tr>
              </thead>
              <tbody>
                {OPTIONS.map(({ id }) => {
                  const a = result.probabilities[id];
                  const b = orderCheck.result!.probabilities[id];
                  return (
                    <tr key={id}>
                      <td className={td}>{id}</td>
                      <td className={td}>{pct(a, 2)}</td>
                      <td className={td}>{pct(b, 2)}</td>
                      <td className={td}>
                        {b - a >= 0 ? "+" : ""}
                        {((b - a) * 100).toFixed(2)} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-sm">
              {orderCheck.result.choice === result.choice
                ? "Same decision either way."
                : `The decision flipped: ${result.choice} → ${orderCheck.result.choice}. Near-ties are exactly where this happens.`}
            </p>
          </div>
        )}
      </section>

      <details>
        <summary className="cursor-pointer text-xl font-bold">5. Raw request and response</summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-sm text-neutral-500">request body (image shortened)</p>
            <Json value={result.request} />
          </div>
          <div>
            <p className="mb-1 text-sm text-neutral-500">response body, untouched</p>
            <Json value={result.raw} />
          </div>
        </div>
      </details>
    </div>
  );
}
