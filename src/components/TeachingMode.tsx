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
    <div ref={card} className="scroll-mt-4 border-4 border-black">
      {result?.mock && step >= 5 && <MockBanner />}
      <div className="flex items-center justify-between gap-3 border-b-4 border-black px-5 py-3">
        <p className="font-bold">
          Teaching Mode: step {step + 1} of {STEPS.length}
        </p>
        <ol className="flex gap-1" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className={`h-3 w-5 border-2 border-black ${i <= step ? "bg-black" : "bg-white"}`} />
          ))}
        </ol>
      </div>

      <div className="grid min-h-[26rem] gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,17rem)_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt="The uploaded profile picture"
          className={`mx-auto aspect-square w-full max-w-64 object-cover ${step === 0 ? "outline-8 outline-yellow-300" : ""} border-4 border-black`}
        />
        <div className="min-w-0">
          <h3 className="meme text-3xl sm:text-4xl">{STEPS[step]}</h3>

          <div className="mt-6 space-y-5 text-xl leading-relaxed">
            {step === 0 && (
              <p>
                This is the <b>state</b>, the thing the question is about. It goes to the model as pixels. Nobody writes a caption for it, and no model writes one either.
              </p>
            )}

            {step >= 1 && step <= 3 && (
              <div className={step === 1 ? "" : "text-neutral-400"}>
                <p className="text-sm font-bold">Question</p>
                <p className="text-2xl">&ldquo;{QUESTION}&rdquo;</p>
              </div>
            )}

            {step >= 2 && step <= 3 && (
              <div className={step === 2 ? "" : "text-neutral-400"}>
                <p className="text-sm font-bold">Choices (we wrote these)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OPTIONS.map((o) => (
                    <span key={o.id} className={`border-2 px-3 py-1 font-mono text-lg ${step === 2 ? "border-black" : "border-neutral-300"}`}>
                      {o.id}
                    </span>
                  ))}
                </div>
                {step === 2 && (
                  <p className="mt-4">
                    Four options. Not a 150,000-token vocabulary, not free text. The model produces exactly one number for each of these and nothing else. It can&apos;t answer &ldquo;dinosaur&rdquo;.
                  </p>
                )}
              </div>
            )}

            {step >= 4 && (
              <p className="text-base text-neutral-500">
                &ldquo;{QUESTION}&rdquo; {OPTIONS.map((o) => o.id).join(" / ")}
              </p>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p>
                  One HTTP request with the image, the question and the four options. One forward pass over all of it.
                </p>
                {(status === "idle" || status === "error") && (
                  <button type="button" onClick={onSend} className="border-4 border-black bg-yellow-300 px-5 py-2 text-xl font-bold hover:bg-black hover:text-yellow-300">
                    {status === "error" ? "Try again" : "Send to Circuit-VL"}
                  </button>
                )}
                {status === "loading" && (
                  <p>
                    Waiting on Circuit-VL&hellip; {elapsed}s{elapsed > 6 && " (the GPU may be waking up; the first call can take about a minute)"}
                  </p>
                )}
                {status === "done" && <p className="font-bold">Answer received. Next.</p>}
                {status === "error" && <p className="text-red-700">{error}</p>}
              </div>
            )}

            {step === 4 && result && (
              <div className="space-y-4">
                <p>
                  No &ldquo;respond with one of architect, apple_guy, femboy, furry&rdquo;. No JSON mode. No parser. The response says{" "}
                  <code className="bg-yellow-200 px-1 font-mono">output_tokens: {result.outputTokens ?? 0}</code>.
                </p>
                <p>
                  Inside the model, a small <b>pointer head</b> compared the hidden state at the end of the sequence (the &ldquo;decide&rdquo; token) with the hidden state at the end of each
                  option. That gives one score per option.
                </p>
              </div>
            )}

            {step === 5 && result && (
              <div>
                <ProbabilityBars probabilities={result.probabilities} winner={result.choice} size="lg" />
                <p className="mt-5 text-lg">Softmax over four scores. These are the actual numbers from the response, not generated text.</p>
              </div>
            )}

            {step === 6 && result && (
              <div>
                <p className="meme text-5xl sm:text-6xl">
                  {winner?.emoji} {winner?.label.toUpperCase()}
                </p>
                <p className="mt-4 text-2xl">&ldquo;{message}&rdquo;</p>
                <p className="mt-6 text-lg">
                  The decision is just the highest probability. In a real system, code decides what to do with it: act above a threshold, send it to a person when the top two are close.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t-4 border-black px-5 py-3">
        <button type="button" onClick={back} disabled={step === 0} className="px-2 py-1 font-bold disabled:opacity-30">
          &larr; Back
        </button>
        <p className="hidden text-sm text-neutral-500 sm:block">Arrow keys and presentation clickers work</p>
        <button
          type="button"
          onClick={next}
          disabled={!(canAdvance || (step === 3 && status !== "loading"))}
          className="border-2 border-black px-3 py-1 font-bold hover:bg-black hover:text-white disabled:opacity-30"
        >
          {step === 3 && status !== "done" ? "Send" : "Next"} &rarr;
        </button>
      </div>
    </div>
  );
}
