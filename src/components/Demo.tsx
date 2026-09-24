"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pickMessage } from "@/config/messages";
import { classifyImage, ClassifyFailure, fileToDataUri } from "@/lib/classifyImage";
import type { DecisionResult, ServiceInfo } from "@/lib/types";

import NerdMode from "./NerdMode";
import ResultCard from "./ResultCard";
import TeachingMode from "./TeachingMode";
import Uploader from "./Uploader";

type Status = "idle" | "loading" | "done" | "error";

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-white/20">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-yellow-300" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-semibold text-white">{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
    </label>
  );
}

export default function Demo() {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [teaching, setTeaching] = useState(false);
  const [nerd, setNerd] = useState(false);
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [run, setRun] = useState(0); // remounts Teaching Mode on a new image
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/classify")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  const send = useCallback(async (uri: string) => {
    setStatus("loading");
    setError(null);
    setElapsed(0);
    const t0 = Date.now();
    timer.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    try {
      const r = await classifyImage(uri);
      setResult(r);
      setMessage(pickMessage(r.choice));
      setStatus("done");
    } catch (e) {
      setError(e instanceof ClassifyFailure ? e.info.error : String(e));
      setStatus("error");
    } finally {
      if (timer.current) clearInterval(timer.current);
    }
  }, []);

  const onFile = async (f: File) => {
    setResult(null);
    setError(null);
    setStatus("idle");
    setRun((n) => n + 1);
    let uri: string;
    try {
      uri = await fileToDataUri(f);
    } catch (e) {
      setError(`could not read that image: ${String(e)}`);
      setStatus("error");
      return;
    }
    setImage(uri);
    if (!teaching) send(uri);
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setStatus("idle");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle on={teaching} onChange={setTeaching} label="Teaching Mode" hint="Walk through the seven stages one at a time. Built for a projector." />
        <Toggle on={nerd} onChange={setNerd} label="Nerd Mode" hint="Show the sequence, the scores, the raw request and response." />
      </div>

      {info?.mode === "mock" && (
        <p className="rounded-xl border border-yellow-300/40 bg-yellow-300/10 px-4 py-2 text-sm text-yellow-200">Server is in mock mode (CIRCUIT_MOCK=1). No model is called; results are clearly marked.</p>
      )}
      {info && info.mode === "hosted" && !info.hasApiKey && (
        <p className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-200">
          CIRCUIT_API_KEY is not set on the server. Get a free key at decisioncircuits.com and put it in <code>.env.local</code> (see the README).
        </p>
      )}

      {!image && <Uploader onFile={onFile} />}

      {image && teaching && (
        <TeachingMode key={run} image={image} status={status} result={result} error={error} message={message} elapsed={elapsed} onSend={() => send(image)} />
      )}

      {image && !teaching && status === "loading" && (
        <div className="flex items-center gap-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="h-24 w-24 rounded-xl object-cover opacity-70" />
          <div>
            <p className="animate-pulse text-lg font-semibold text-white">Circuit-VL is scoring four options… {elapsed}s</p>
            <p className="text-sm text-slate-400">
              {elapsed > 6 ? "The hosted GPU scales to zero. A cold start takes about a minute; warm calls are well under a second." : "One forward pass. No tokens to generate."}
            </p>
          </div>
        </div>
      )}

      {image && !teaching && status === "done" && result && <ResultCard image={image} result={result} message={message} />}

      {status === "error" && !teaching && (
        <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-5 text-red-200">
          <p className="font-semibold">No decision. We will not make one up.</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {image && nerd && result && status === "done" && <NerdMode key={result.requestId ?? run} image={image} result={result} />}

      {image && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">
            Try another PFP
          </button>
          {status === "error" && (
            <button type="button" onClick={() => send(image)} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
