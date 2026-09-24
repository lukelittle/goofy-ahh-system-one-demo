import { optionById } from "@/config/decision";
import { pointerSegments } from "@/lib/pointerLayout";
import type { ChoiceQuestion } from "@/lib/types";

/**
 * The input sequence Circuit-VL reads, coloured by role. The two kinds of
 * position the pointer head reads are highlighted: each option's closing
 * delimiter (a "key") and the final decide token (the "query").
 */
export default function SequenceView({ question }: { question: ChoiceQuestion }) {
  const segs = pointerSegments(question);
  return (
    <div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/60 p-4 font-mono text-[12.5px] leading-relaxed text-slate-300">
        {segs.map((s, i) => {
          switch (s.kind) {
            case "frame":
              return (
                <span key={i} className="text-slate-600">
                  {s.text}
                </span>
              );
            case "image":
              return (
                <span key={i} className="rounded bg-violet-500/25 px-1 text-violet-200">
                  {s.text}
                </span>
              );
            case "optStart":
              return (
                <span key={i} className="text-emerald-400">
                  {s.text}
                </span>
              );
            case "optBody": {
              const opt = optionById(s.option);
              return (
                <span key={i} style={{ color: opt?.color }}>
                  {s.text}
                </span>
              );
            }
            case "optEnd":
              return (
                <span key={i} className="rounded bg-emerald-400/20 px-0.5 font-bold text-emerald-300 ring-1 ring-emerald-400/60" title={`key: hidden state read here for ${s.option}`}>
                  {s.text}
                </span>
              );
            case "decide":
              return (
                <span key={i} className="rounded bg-yellow-300/20 px-0.5 font-bold text-yellow-200 ring-1 ring-yellow-300/70" title="query: hidden state read here">
                  {s.text}
                </span>
              );
            default:
              return <span key={i}>{s.text}</span>;
          }
        })}
      </pre>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
        <li>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-violet-500/60" /> image tokens (frozen vision encoder)
        </li>
        <li>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/70" /> <code>&lt;|box_end|&gt;</code>: the head reads a key here, one per option
        </li>
        <li>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-yellow-300/70" /> <code>&lt;|fim_middle|&gt;</code>: the decide token, the head reads its query here
        </li>
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Reconstructed from <code>s1proto/template.py</code> (pointer layout) and <code>s1proto/media.py</code> in the open-source circuit server. We send JSON; the server renders this. Chat-template framing is approximate; the
        option and decide layout is as in the source.
      </p>
    </div>
  );
}
