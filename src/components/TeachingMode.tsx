"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { OPTIONS, QUESTION, optionById } from "@/config/decision";
import type { DecisionResult } from "@/lib/types";

import MockBanner from "./MockBanner";
import ProbabilityBars from "./ProbabilityBars";

const STEPS = [
  "Here's the image.",
  "Here's the question.",
  "Here are the ONLY possible choices.",
  "Send them to Circuit-VL.",
  "Notice: we did NOT ask it to generate an answer.",
  "Here are the probabilities.",
  "Here's the decision.",
];

type Status = "idle" | "loading" | "done" | "error";

export default function TeachingMode({
  image,
  status,
  result,
  error,
  message,
  elapsed,
  onSend,
}: {
  image: string;
  status: Status;
  result: DecisionResult | null;
  error: string | null;
  message: string;
  elapsed: number;
  onSend: () => void;
}) {
  const [step, setStep] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);
  const canAdvance = step < 3 || (step < STEPS.length - 1 && status === "done");

  const next = useCallback(() => {
    if (step === 3 && (status === "idle" || status === "error")) onSend();
    else if (canAdvance) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [step, status, canAdvance, onSend]);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  // Presenter clickers send arrow keys / page up/down.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      const tag = el?.tagName ?? "";
      const typing = tag === "TEXTAREA" || el?.isContentEditable || (el instanceof HTMLInputElement && !["checkbox", "radio", "file", "button"].includes(el.type));
      if (typing) return;
      // Let Space press whatever control has focus (a button, or the mode toggles).
      if (e.key === " " && (tag === "BUTTON" || tag === "SUMMARY" || tag === "INPUT")) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  const winner = result ? optionById(result.choice) : undefined;

  return (
    <div ref={card} className="scroll-mt-4 overflow-hidden rounded-3xl border border-yellow-300/30 bg-slate-900/80">
      {result?.mock && step >= 5 && <MockBanner />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-yellow-300">Teaching Mode · step {step + 1} of {STEPS.length}</p>
        <ol className="flex gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className={`h-2 w-7 rounded-full ${i <= step ? "bg-yellow-300" : "bg-white/10"}`} />
          ))}
        </ol>
      </div>

      <div className="grid min-h-[26rem] gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,18rem)_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt="The uploaded profile picture"
          className={`mx-auto aspect-square w-full max-w-72 rounded-2xl object-cover ring-4 transition ${step === 0 ? "ring-yellow-300" : "ring-white/10"}`}
        />
        <div className="min-w-0">
          <h3 className="font-display text-3xl leading-tight text-white sm:text-4xl">{STEPS[step]}</h3>

          <div className="mt-6 space-y-5 text-lg text-slate-300">
            {step === 0 && (
              <p>
                This is the <b className="text-white">state</b>: the thing the question is about. It goes to the model as pixels. Nobody writes a caption for it, and no model writes one either.
              </p>
            )}

            {step >= 1 && step <= 3 && (
              <div className={step === 1 ? "" : "opacity-60"}>
                <p className="text-sm uppercase tracking-wider text-slate-500">Question</p>
                <p className="mt-1 text-2xl text-white">“{QUESTION}”</p>
              </div>
            )}

            {step >= 2 && step <= 3 && (
              <div className={step === 2 ? "" : "opacity-60"}>
                <p className="text-sm uppercase tracking-wider text-slate-500">Choices, written by us</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OPTIONS.map((o) => (
                    <span key={o.id} className="rounded-xl border-2 px-3 py-1.5 font-mono text-base text-white" style={{ borderColor: o.color }}>
                      {o.emoji} {o.id}
                    </span>
                  ))}
                </div>
                {step === 2 && (
                  <p className="mt-4">
                    Four options. Not a vocabulary of 150,000 tokens, not free text. The model will produce exactly one number for each of these, and nothing else. It cannot answer “dinosaur”.
                  </p>
                )}
              </div>
            )}

            {step >= 4 && (
              <p className="text-sm text-slate-500">
                “{QUESTION}” ·{" "}
                {OPTIONS.map((o) => (
                  <code key={o.id} className="mr-1.5 rounded border border-white/15 px-1.5 py-0.5 text-slate-300">
                    {o.id}
                  </code>
                ))}
              </p>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p>
                  One HTTP request: <code className="text-base text-emerald-300">{"{ state: {image}, questions: {archetype: {type: \"choice\", criteria: {…4 options…}}} }"}</code>. One forward pass over image + question + options.
                </p>
                {(status === "idle" || status === "error") && (
                  <button type="button" onClick={onSend} className="rounded-2xl bg-yellow-300 px-6 py-3 text-lg font-bold text-black hover:bg-yellow-200">
                    {status === "error" ? "Try again →" : "Send to Circuit-VL →"}
                  </button>
                )}
                {status === "loading" && (
                  <p className="animate-pulse text-yellow-200">
                    Waiting on Circuit-VL… {elapsed}s{elapsed > 6 && " (a scale-to-zero GPU may be waking up; the first call can take about a minute)"}
                  </p>
                )}
                {status === "done" && <p className="text-emerald-300">Answer received. Next →</p>}
                {status === "error" && <p className="text-red-300">{error}</p>}
              </div>
            )}

            {step === 4 && result && (
              <div className="space-y-4">
                <p>
                  There was no instruction like <i>“respond with one of architect, apple_guy, femboy, furry”</i>, no JSON mode, no parser. The response carries{" "}
                  <b className="font-mono text-white">output_tokens: {result.outputTokens ?? 0}</b>.
                </p>
                <p>
                  Inside the model, a small <b className="text-white">pointer head</b> compared the hidden state at the end of the sequence (a “decide” token) with the hidden state at the end of each
                  option, producing one score per option.
                </p>
              </div>
            )}

            {step === 5 && result && (
              <div>
                <ProbabilityBars probabilities={result.probabilities} winner={result.choice} size="lg" />
                <p className="mt-5 text-base">A softmax over four scores. These are the actual numbers from the response, not a rendering of generated text.</p>
              </div>
            )}

            {step === 6 && result && (
              <div>
                <p className="font-display text-5xl text-white sm:text-6xl">
                  {winner?.emoji} {winner?.label.toUpperCase()}
                </p>
                <p className="mt-4 text-xl italic text-yellow-200">“{message}”</p>
                <p className="mt-6 text-base">
                  The decision is the argmax of the distribution. In a real system, code would decide what to do with it: act above a threshold, send it to a human when the top two are close.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
        <button type="button" onClick={back} disabled={step === 0} className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/5 disabled:opacity-30">
          ← Back
        </button>
        <p className="hidden text-xs text-slate-500 sm:block">Arrow keys or a presentation clicker work too</p>
        <button
          type="button"
          onClick={next}
          disabled={!(canAdvance || (step === 3 && status !== "loading"))}
          className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 disabled:opacity-30"
        >
          {step === 3 && status !== "done" ? "Send →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
