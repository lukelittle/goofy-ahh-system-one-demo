"use client";

import { useState } from "react";

import { OPTIONS, QUESTION, optionById } from "@/config/decision";
import { classifyImage, ClassifyFailure } from "@/lib/classifyImage";
import { logScores, pct, sortedEntries } from "@/lib/math";
import type { ChoiceQuestion, DecisionResult } from "@/lib/types";

import SequenceView from "./SequenceView";

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3">
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 break-all font-mono text-sm text-slate-100">{value}</dd>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Json({ value }: { value: unknown }) {
  return <pre className="max-h-80 overflow-auto rounded-xl bg-black/60 p-4 font-mono text-xs text-slate-300">{JSON.stringify(value, null, 2)}</pre>;
}

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

  return (
    <div className="space-y-8 rounded-3xl border border-emerald-400/20 bg-slate-950/80 p-6 sm:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-400">Nerd Mode</p>
        <h3 className="mt-1 text-2xl font-bold text-white">What actually went over the wire</h3>
      </div>

      <section className="grid gap-6 md:grid-cols-[10rem_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="aspect-square w-40 rounded-xl object-cover" />
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-mono text-slate-500">state</span> <span className="text-slate-300">= {"{"} image: &lt;the JPEG above as a data URI&gt; {"}"}</span>
          </p>
          <p>
            <span className="font-mono text-slate-500">question</span> <span className="text-slate-300">= “{QUESTION}”</span>
          </p>
          <div>
            <span className="font-mono text-slate-500">choices</span>{" "}
            <span className="text-slate-300">= the only answers that exist, supplied by us:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.optionOrder.map((id) => (
                <code key={id} className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-slate-100">
                  {id}
                </code>
              ))}
            </div>
          </div>
        </div>
      </section>

      {question && (
        <section>
          <h4 className="mb-2 font-semibold text-white">1. The sequence the model reads (one forward pass over all of it)</h4>
          <SequenceView question={question} />
        </section>
      )}

      <section>
        <h4 className="mb-2 font-semibold text-white">2. Scoring: one score per supplied option, then softmax</h4>
        <div className="overflow-x-auto rounded-xl bg-black/40">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">option (we supplied it)</th>
                <th className="px-4 py-2">→ score = log p</th>
                <th className="px-4 py-2">→ probability</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {sortedEntries(result.probabilities).map(([id, p]) => (
                <tr key={id} className={`border-t border-white/5 ${id === result.choice ? "text-white" : "text-slate-400"}`}>
                  <td className="px-4 py-2">
                    <span style={{ color: optionById(id)?.color }}>{id}</span>
                    {id === result.choice && <span className="ml-2 rounded bg-yellow-300/20 px-1.5 text-[11px] text-yellow-200">argmax</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{scores[id].toFixed(3)}</td>
                  <td className="px-4 py-2 tabular-nums">{pct(p, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          On the server the head computes <code>logit_i = (W_k·h_&lt;/opt_i&gt;) · (W_q·h_&lt;decide&gt;) / √d</code>, divides by a calibrated temperature and applies softmax. The API returns probabilities, not
          logits, so the score column is <code>log p_i</code>: the temperature-scaled logit minus one constant shared by every option. Differences between rows are exact; absolute values are
          not.
        </p>
      </section>

      <section>
        <h4 className="mb-3 font-semibold text-white">3. The answer and the bookkeeping</h4>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="selected choice" value={result.choice} hint="argmax of the distribution, picked by the server" />
          <Stat label="confidence" value={result.confidence.toFixed(3)} hint="1 − H(p)/log N" />
          <Stat label="round trip" value={result.mock ? "—" : `${Math.round(result.latencyMs)} ms`} hint={result.attempts > 1 ? `${result.attempts} attempts (cold start retries)` : "this server → endpoint → back"} />
          <Stat label="server forward pass" value={result.serverLatencyMs ? `${result.serverLatencyMs.toFixed(0)} ms` : "not reported"} hint="x-s1-latency-ms, if forwarded" />
          <Stat label="model (as reported)" value={result.model} />
          <Stat label="model (requested)" value={result.requestedModel} />
          <Stat label="tokens in / out" value={`${result.inputTokens ?? "?"} / ${result.outputTokens ?? "?"}`} hint="out is 0: nothing was generated" />
          <Stat label="request id" value={result.requestId ?? "—"} />
        </dl>
        <p className="mt-2 break-all text-xs text-slate-500">
          endpoint: <code>{result.endpoint}</code>
          {Object.keys(result.headers).length > 0 && (
            <>
              {" "}
              · headers: <code>{Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`).join(" · ")}</code>
            </>
          )}
        </p>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-white">4. Does the order of the options matter?</h4>
        <p className="mb-3 text-sm text-slate-400">
          Options are part of the input sequence, so their order can nudge the scores. The author measured 3.6% top-answer flips under reordering for circuit-vl-4b v1.1 on its own grid. Ask
          again with the same options reversed:
        </p>
        <button
          type="button"
          onClick={runOrderCheck}
          disabled={orderCheck.status === "loading"}
          className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
        >
          {orderCheck.status === "loading" ? "Asking again…" : `Re-ask as [${reversed.join(", ")}]`}
        </button>
        {orderCheck.status === "error" && <p className="mt-3 text-sm text-red-300">{orderCheck.error}</p>}
        {orderCheck.status === "done" && orderCheck.result && (
          <div className="mt-4 overflow-x-auto rounded-xl bg-black/40">
            <table className="w-full min-w-[28rem] font-mono text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2">option</th>
                  <th className="px-4 py-2">original order</th>
                  <th className="px-4 py-2">reversed</th>
                  <th className="px-4 py-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {OPTIONS.map(({ id }) => {
                  const a = result.probabilities[id];
                  const b = orderCheck.result!.probabilities[id];
                  return (
                    <tr key={id} className="border-t border-white/5 text-slate-300">
                      <td className="px-4 py-2">{id}</td>
                      <td className="px-4 py-2">{pct(a, 2)}</td>
                      <td className="px-4 py-2">{pct(b, 2)}</td>
                      <td className="px-4 py-2">{((b - a) * 100).toFixed(2)} pts</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-slate-400">
              {orderCheck.result.choice === result.choice ? "Same decision either way." : `The decision flipped: ${result.choice} → ${orderCheck.result.choice}. A near-tie is exactly where this happens.`}
            </p>
          </div>
        )}
      </section>

      <details className="group">
        <summary className="cursor-pointer font-semibold text-white">5. Raw request and response</summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-slate-500">request body (image shortened)</p>
            <Json value={result.request} />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">response body, untouched</p>
            <Json value={result.raw} />
          </div>
        </div>
      </details>
    </div>
  );
}
