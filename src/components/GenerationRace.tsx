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
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Illustration only: one tick is one step, not a measured time.</p>
        <button type="button" onClick={play} className="rounded-xl bg-yellow-300 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-200">
          {tick === 0 ? "▶ Play" : "↻ Replay"}
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/5 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-rose-300">Generative VLM</p>
          <p className="mt-1 text-xs text-slate-400">prefill, then one forward pass per output token</p>
          <div className="mt-4 min-h-12 rounded-lg bg-black/50 p-3 font-mono text-sm text-rose-100">
            {emitted.map((t, i) => (
              <span key={i} className="mr-0.5 rounded bg-rose-400/20 px-0.5">
                {t}
              </span>
            ))}
            {!genDone && playing && <span className="animate-pulse">▍</span>}
          </div>
          <p className="mt-3 font-mono text-xs text-slate-400">
            steps: {Math.min(emitted.length + (tick > 0 ? 1 : 0), GENERATED.length + 1)} · {parsed ? <span className="text-emerald-300">JSON.parse ✓ · validate ✓ → decision</span> : genDone ? "parsing…" : "generating…"}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald-300">Circuit-VL</p>
          <p className="mt-1 text-xs text-slate-400">one forward pass over image + question + options</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OPTIONS.map((o, i) => (
              <div key={o.id} className={`rounded-lg border px-2 py-2 text-center font-mono text-xs transition duration-300 ${decided ? "border-emerald-400/50 bg-emerald-400/10 text-white" : "border-white/10 text-slate-500"}`}>
                {o.id}
                <div className="mt-1 text-emerald-300">{decided ? `p${"₁₂₃₄"[i]}` : "·"}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-xs text-slate-400">steps: {tick > 0 ? 1 : 0} · {decided ? <span className="text-emerald-300">softmax → distribution → decision</span> : tick > 0 ? "forward pass…" : "waiting"}</p>
        </div>
      </div>
    </div>
  );
}
