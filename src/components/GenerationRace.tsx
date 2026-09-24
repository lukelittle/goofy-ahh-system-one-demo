"use client";

import { useEffect, useState } from "react";

import { OPTIONS } from "@/config/decision";

/**
 * An illustration, not a benchmark: the left side emits one token per tick the
 * way an autoregressive model does; the right side produces its whole answer
 * from one pass. Timings are made up for the animation and labelled as such.
 * The right-hand numbers are placeholders, shown as "p₁…p₄", never as values.
 */
const GENERATED = ['{"', "arch", "etype", '":', ' "', "fur", "ry", '"}'];

export default function GenerationRace() {
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = GENERATED.length + 3;

  useEffect(() => {
    if (!playing || tick >= total) return;
    const t = setTimeout(() => {
      setTick((n) => n + 1);
      if (tick + 1 >= total) setPlaying(false);
    }, 450);
    return () => clearTimeout(t);
  }, [playing, tick, total]);

  const play = () => {
    setTick(0);
    setPlaying(true);
  };

  const emitted = GENERATED.slice(0, Math.max(0, tick - 1));
  const genDone = tick > GENERATED.length;
  const parsed = tick > GENERATED.length + 1;
  const decided = tick >= 2;

  return (
    <div className="border-2 border-black p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-600">Illustration only: one tick is one step, not a measured time.</p>
        <button type="button" onClick={play} className="border-2 border-black bg-yellow-300 px-3 py-1 font-bold hover:bg-black hover:text-yellow-300">
          {tick === 0 ? "▶ Play" : "↻ Replay"}
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="border-2 border-black p-3">
          <p className="font-bold">Generative VLM</p>
          <p className="text-sm text-neutral-600">prefill, then one forward pass per output token</p>
          <div className="mt-3 min-h-12 bg-neutral-100 p-3 font-mono text-sm">
            {emitted.map((t, i) => (
              <span key={i} className="mr-0.5 border border-neutral-400 bg-white px-0.5">
                {t}
              </span>
            ))}
            {!genDone && playing && <span className="animate-pulse">▍</span>}
          </div>
          <p className="mt-3 font-mono text-xs text-neutral-600">
            steps: {Math.min(emitted.length + (tick > 0 ? 1 : 0), GENERATED.length + 1)} · {parsed ? <span className="font-bold text-black">JSON.parse ✓ · validate ✓ → decision</span> : genDone ? "parsing…" : tick > 0 ? "generating…" : "waiting"}
          </p>
        </div>
        <div className="border-2 border-black bg-yellow-50 p-3">
          <p className="font-bold">Circuit-VL</p>
          <p className="text-sm text-neutral-600">one forward pass over image + question + options</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OPTIONS.map((o, i) => (
              <div key={o.id} className={`border-2 px-2 py-2 text-center font-mono text-xs transition duration-300 ${decided ? "border-black bg-white" : "border-neutral-300 text-neutral-400"}`}>
                {o.id}
                <div className="mt-1 font-bold">{decided ? `p${"₁₂₃₄"[i]}` : "·"}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-xs text-neutral-600">steps: {tick > 0 ? 1 : 0} · {decided ? <span className="font-bold text-black">softmax → distribution → decision</span> : tick > 0 ? "forward pass…" : "waiting"}</p>
        </div>
      </div>
    </div>
  );
}
