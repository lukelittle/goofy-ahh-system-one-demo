"use client";

import { useRef, useState } from "react";

import { OPTIONS } from "@/config/decision";
import { pct } from "@/lib/math";
import type { DecisionResult } from "@/lib/types";

/**
 * The "4 types of IT guys" meme with the art taken out: four empty panels
 * labelled with the options. Before an upload the whole grid is the drop
 * target. After a decision, the uploaded picture fills the winning panel and
 * every panel shows its probability.
 */
export default function MemeGrid({
  image,
  result,
  loading,
  onFile,
}: {
  image: string | null;
  result: DecisionResult | null;
  loading: boolean;
  onFile: (f: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const accepting = !image;

  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <p className="meme mb-3 text-center text-3xl sm:text-5xl">The 4 types of IT guys</p>
      <div
        role={accepting ? "button" : undefined}
        tabIndex={accepting ? 0 : undefined}
        aria-label={accepting ? "Upload a profile picture" : undefined}
        onClick={() => accepting && input.current?.click()}
        onKeyDown={(e) => {
          if (accepting && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          if (!accepting) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (accepting) take(e.dataTransfer.files);
        }}
        className={`relative grid grid-cols-2 gap-[4px] border-4 border-black bg-black ${accepting ? "cursor-pointer" : ""}`}
      >
        {OPTIONS.map((o) => {
          const p = result?.probabilities[o.id];
          const won = result?.choice === o.id;
          return (
            <div key={o.id} className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden ${over ? "bg-yellow-100" : "bg-white"}`}>
              {won && image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local data URI */}
                  <img src={image} alt={`The uploaded picture, classified as ${o.label}`} className="absolute inset-0 h-full w-full object-cover" />
                  <span className="meme-caption absolute inset-x-0 top-2 text-center text-2xl sm:text-4xl">{o.label}</span>
                  <span className="meme-caption absolute inset-x-0 bottom-2 text-center text-3xl sm:text-5xl">{pct(p ?? 0)}</span>
                </>
              ) : (
                <div className="text-center">
                  <p className={`text-2xl font-bold sm:text-3xl ${result ? "text-neutral-400" : "text-neutral-300"}`}>{o.label}</p>
                  {p !== undefined && <p className="mt-1 font-mono text-xl text-neutral-500 sm:text-2xl">{pct(p, p < 0.01 ? 1 : 0)}</p>}
                  {loading && <p className="mt-1 font-mono text-sm text-neutral-400">scoring…</p>}
                </div>
              )}
            </div>
          );
        })}
        {accepting && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="border-4 border-black bg-white px-4 py-2 text-center text-base font-bold sm:text-lg">
              Drop a PFP here
              <span className="block text-sm font-normal text-neutral-600">or click to pick one</span>
            </span>
          </div>
        )}
        {loading && image && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-28 w-28 border-4 border-black object-cover sm:h-36 sm:w-36" />
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
