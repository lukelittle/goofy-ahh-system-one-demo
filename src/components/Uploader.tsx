"use client";

import { useRef, useState } from "react";

export default function Uploader({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
      className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
        over ? "border-yellow-300 bg-yellow-300/10" : "border-white/15 bg-white/[0.03] hover:border-violet-400/60 hover:bg-violet-400/5"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <span className="text-5xl transition group-hover:scale-110 group-hover:-rotate-6" aria-hidden>
        🖼️
      </span>
      <span className="text-lg font-semibold text-white">Drop a PFP here, or click to choose one</span>
      <span className="text-sm text-slate-400">PNG, JPEG, WebP or GIF. Resized in your browser to 896 px before upload.</span>
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
