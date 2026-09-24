import { optionById } from "@/config/decision";
import { LOW_CONFIDENCE_MESSAGE, LOW_CONFIDENCE_THRESHOLD } from "@/config/messages";
import { pct } from "@/lib/math";
import type { DecisionResult } from "@/lib/types";

import ProbabilityBars from "./ProbabilityBars";

/** The verdict under the grid: winner, joke, and the model's numbers. */
export default function ResultCard({ result, message }: { result: DecisionResult; message: string }) {
  const opt = optionById(result.choice);
  const top = result.probabilities[result.choice] ?? 0;
  return (
    <div className="mt-6">
      <p className="meme text-4xl sm:text-5xl">
        {opt?.emoji} {opt?.label.toUpperCase() ?? result.choice}
      </p>
      <p className="mt-2 text-xl">&ldquo;{message}&rdquo;</p>
      {top < LOW_CONFIDENCE_THRESHOLD && <p className="mt-1 text-neutral-600">{LOW_CONFIDENCE_MESSAGE}</p>}
      <div className="mt-5">
        <ProbabilityBars probabilities={result.probabilities} winner={result.choice} />
      </div>
      <p className="mt-3 text-sm text-neutral-500">
        {result.mock ? "Mock numbers, not a model. " : "These are Circuit-VL's actual probabilities, unmodified. "}
        P({result.choice}) = {pct(top, 1)}, confidence {result.confidence.toFixed(2)},{" "}
        {result.mock ? "no model call" : `${Math.round(result.latencyMs)} ms round trip`}, {result.outputTokens ?? 0} output tokens.
      </p>
    </div>
  );
}
