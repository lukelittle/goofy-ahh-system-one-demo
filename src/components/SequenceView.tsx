import { pointerSegments } from "@/lib/pointerLayout";
import type { ChoiceQuestion } from "@/lib/types";

/**
 * The input sequence Circuit-VL reads, marked by role. The two kinds of
 * position the pointer head reads are highlighted: each option's closing
 * delimiter (a "key") and the final decide token (the "query").
 */
export default function SequenceView({ question }: { question: ChoiceQuestion }) {
  const segs = pointerSegments(question);
  return (
    <div>
      <pre className="max-h-96 overflow-auto border-2 border-black bg-neutral-50 p-4 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">
        {segs.map((s, i) => {
          switch (s.kind) {
            case "frame":
            case "optStart":
              return (
                <span key={i} className="text-neutral-400">
                  {s.text}
                </span>
              );
            case "image":
              return (
                <span key={i} className="bg-neutral-200 px-1 text-neutral-600">
                  {s.text}
                </span>
              );
            case "optBody":
              return <span key={i}>{s.text}</span>;
            case "optEnd":
              return (
                <mark key={i} className="bg-lime-300 font-bold text-black" title={`key: hidden state read here for ${s.option}`}>
                  {s.text}
                </mark>
              );
            case "decide":
              return (
                <mark key={i} className="bg-yellow-300 font-bold text-black" title="query: hidden state read here">
                  {s.text}
                </mark>
              );
            default:
              return <span key={i}>{s.text}</span>;
          }
        })}
      </pre>
      <ul className="mt-2 space-y-0.5 text-sm">
        <li>
          <mark className="bg-neutral-200 px-1">grey</mark>: image tokens from the frozen vision encoder
        </li>
        <li>
          <mark className="bg-lime-300 px-1">green</mark>: <code>&lt;|box_end|&gt;</code>, where the head reads one key per option
        </li>
        <li>
          <mark className="bg-yellow-300 px-1">yellow</mark>: <code>&lt;|fim_middle|&gt;</code>, the decide token, where the head reads its query
        </li>
      </ul>
      <p className="mt-2 text-sm text-neutral-500">
        Reconstructed from <code>s1proto/template.py</code> (pointer layout) and <code>s1proto/media.py</code> in the open-source circuit server. We send JSON and the server renders this. The chat-template
        wrapper is approximate; the option and decide layout matches the source.
      </p>
    </div>
  );
}
