import { optionById } from "@/config/decision";
import { LOW_CONFIDENCE_MESSAGE, LOW_CONFIDENCE_THRESHOLD } from "@/config/messages";
import { pct } from "@/lib/math";
import type { DecisionResult } from "@/lib/types";

import MockBanner from "./MockBanner";
import ProbabilityBars from "./ProbabilityBars";

export default function ResultCard({ image, result, message }: { image: string; result: DecisionResult; message: string }) {
  const opt = optionById(result.choice);
  const top = result.probabilities[result.choice] ?? 0;
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-violet-950/40">
      {result.mock && <MockBanner />}
      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,15rem)_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local data URI, nothing to optimise */}
        <img src={image} alt="The uploaded profile picture" className="mx-auto aspect-square w-full max-w-60 rounded-2xl object-cover ring-4 ring-white/10" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">The decision</p>
          <h3 className="font-display mt-2 text-4xl text-white sm:text-5xl">
            <span aria-hidden className="mr-3">
              {opt?.emoji}
            </span>
            {opt?.label.toUpperCase() ?? result.choice}
          </h3>
          <p className="mt-3 text-lg italic text-yellow-200">“{message}”</p>
          {top < LOW_CONFIDENCE_THRESHOLD && <p className="mt-2 text-sm text-amber-300">{LOW_CONFIDENCE_MESSAGE}</p>}
          <div className="mt-6">
            <ProbabilityBars probabilities={result.probabilities} winner={result.choice} />
          </div>
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            {result.mock ? "Mock numbers. " : "Actual Circuit-VL probabilities, unmodified. "}
            P({result.choice}) = {pct(top, 1)} · confidence {result.confidence.toFixed(2)} (1 − normalised entropy) ·{" "}
            {result.mock ? "no model call" : `${Math.round(result.latencyMs)} ms round trip`} · {result.outputTokens ?? 0} output tokens
          </p>
        </div>
      </div>
    </div>
  );
}
