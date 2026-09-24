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
  const big = size === "lg";
  return (
    <table className={`w-full border-collapse ${big ? "text-xl" : "text-base"}`} aria-label="Probability per option">
      <tbody>
        {sortedEntries(probabilities).map(([id, p]) => {
          const opt = optionById(id) ?? OPTIONS[0];
          const isWinner = id === winner;
          return (
            <tr key={id} className={isWinner ? "font-bold" : "text-neutral-600"}>
              <td className="w-32 py-1 pr-3 whitespace-nowrap sm:w-40">{opt.label}</td>
              <td className="py-1">
                <div className={`border border-black ${big ? "h-7" : "h-5"}`}>
                  <div className={`h-full ${isWinner ? "bg-black" : "bg-neutral-400"}`} style={{ width: `${Math.max(p * 100, 0.4)}%` }} />
                </div>
              </td>
              <td className="w-20 py-1 pl-3 text-right font-mono tabular-nums">{pct(p, p < 0.01 ? 1 : 0)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
