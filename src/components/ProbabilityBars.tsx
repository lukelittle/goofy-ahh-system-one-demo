import { OPTIONS, optionById } from "@/config/decision";
import { pct, sortedEntries } from "@/lib/math";

export default function ProbabilityBars({
  probabilities,
  winner,
  size = "md",
}: {
  probabilities: Record<string, number>;
  winner?: string;
  size?: "md" | "lg";
}) {
  const rows = sortedEntries(probabilities);
  const big = size === "lg";
  return (
    <ul className={big ? "space-y-4" : "space-y-2.5"} aria-label="Probability per option">
      {rows.map(([id, p]) => {
        const opt = optionById(id) ?? OPTIONS[0];
        const isWinner = id === winner;
        return (
          <li key={id} className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-3 sm:grid-cols-[9rem_1fr_4.5rem]">
            <span className={`truncate font-medium ${big ? "text-lg" : "text-sm"} ${isWinner ? "text-white" : "text-slate-400"}`}>
              <span aria-hidden className="mr-1.5">
                {opt.emoji}
              </span>
              {opt.label}
            </span>
            <span className={`relative block overflow-hidden rounded-full bg-white/5 ${big ? "h-6" : "h-4"}`}>
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(p * 100, 0.5)}%`, background: opt.color, opacity: isWinner ? 1 : 0.55 }}
              />
            </span>
            <span className={`text-right font-mono tabular-nums ${big ? "text-lg" : "text-sm"} ${isWinner ? "text-white" : "text-slate-400"}`}>
              {pct(p, p < 0.01 ? 1 : 0)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
