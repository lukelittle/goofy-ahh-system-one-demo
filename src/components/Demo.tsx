"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pickMessage } from "@/config/messages";
import { classifyImage, ClassifyFailure, fileToDataUri } from "@/lib/classifyImage";
import type { DecisionResult, ServiceInfo } from "@/lib/types";

import MemeGrid from "./MemeGrid";
import MockBanner from "./MockBanner";
import NerdMode from "./NerdMode";
import ResultCard from "./ResultCard";
import TeachingMode from "./TeachingMode";

type Status = "idle" | "loading" | "done" | "error";

function Check({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-black" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-bold">{label}</span> <span className="text-neutral-600">{hint}</span>
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
      setError(`Could not read that image: ${String(e)}`);
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

  const showTeaching = teaching && image;

  return (
    <div>
      <div className="mb-6 space-y-1.5">
        <Check on={teaching} onChange={setTeaching} label="Teaching Mode" hint="walk through it one step at a time (for a projector)" />
        <Check on={nerd} onChange={setNerd} label="Nerd Mode" hint="show the token sequence, the scores, and the raw request and response" />
      </div>

      {info?.mode === "mock" && (
        <div className="mb-4">
          <MockBanner />
        </div>
      )}
      {info && info.mode === "hosted" && !info.hasApiKey && (
        <p className="mb-4 border-l-4 border-red-600 pl-3 text-red-700">
          CIRCUIT_API_KEY isn&apos;t set on the server. Get a free key at decisioncircuits.com and put it in <code>.env.local</code>.
        </p>
      )}

      {showTeaching ? (
        <TeachingMode key={run} image={image} status={status} result={result} error={error} message={message} elapsed={elapsed} onSend={() => send(image)} />
      ) : (
        <>
          <MemeGrid image={image} result={status === "done" ? result : null} loading={status === "loading"} onFile={onFile} />
          {status === "loading" && (
            <p className="mt-4 text-lg">
              Circuit-VL is scoring four options&hellip; {elapsed}s
              <span className="block text-sm text-neutral-600">
                {elapsed > 6 ? "The hosted GPU scales to zero, so a cold start takes about a minute. Warm calls take well under a second." : "One forward pass. Nothing to generate."}
              </span>
            </p>
          )}
          {status === "done" && result && (
            <>
              {result.mock && (
                <div className="mt-4">
                  <MockBanner />
                </div>
              )}
              <ResultCard result={result} message={message} />
            </>
          )}
        </>
      )}

      {status === "error" && !teaching && (
        <div className="mt-4 border-l-4 border-red-600 pl-3 text-red-700">
          <p className="font-bold">No decision. We won&apos;t make one up.</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {image && (
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={reset} className="border-2 border-black px-3 py-1.5 font-bold hover:bg-black hover:text-white">
            Try another PFP
          </button>
          {status === "error" && (
            <button type="button" onClick={() => send(image)} className="border-2 border-black px-3 py-1.5 font-bold hover:bg-black hover:text-white">
              Retry
            </button>
          )}
        </div>
      )}

      {image && nerd && result && status === "done" && (
        <div className="mt-10">
          <NerdMode key={result.requestId ?? run} image={image} result={result} />
        </div>
      )}
    </div>
  );
}
