import { optionById } from "@/config/decision";
import { MIN_ROLE_PROBABILITY, ROLE_NAMES, UNCLASSIFIABLE_EMOJI, UNCLASSIFIABLE_KEY, UNCLASSIFIABLE_NAME } from "@/config/discord";
import { DEFAULT_AVATAR_MESSAGES, pickFrom, pickMessage, UNSURE_MESSAGES } from "@/config/messages";
import { sortedEntries } from "@/lib/math";
import type { DecisionResult } from "@/lib/types";

/**
 * How a Circuit-VL answer becomes a role. Pure functions, no Discord calls,
 * so they can be tested offline (decide.test.ts).
 *
 * The model returns a distribution. Everything after that is our code:
 * pick the top option, fall back to Unclassifiable below a threshold or
 * when there is no PFP to look at.
 */

export type RoleKey = string; // an option id, or UNCLASSIFIABLE_KEY

export type RoleDecision =
  | { key: RoleKey; reason: "decided"; result: DecisionResult }
  | { key: typeof UNCLASSIFIABLE_KEY; reason: "unsure"; result: DecisionResult }
  | { key: typeof UNCLASSIFIABLE_KEY; reason: "default_avatar" };

export const ALL_ROLE_KEYS: RoleKey[] = [...Object.keys(ROLE_NAMES), UNCLASSIFIABLE_KEY];

export function roleName(key: RoleKey): string {
  return key === UNCLASSIFIABLE_KEY ? UNCLASSIFIABLE_NAME : ROLE_NAMES[key];
}

export function decideRole(result: DecisionResult | null, opts: { defaultAvatar: boolean; minProbability?: number }): RoleDecision {
  if (opts.defaultAvatar || !result) return { key: UNCLASSIFIABLE_KEY, reason: "default_avatar" };
  const top = result.probabilities[result.choice] ?? 0;
  if (top < (opts.minProbability ?? MIN_ROLE_PROBABILITY)) return { key: UNCLASSIFIABLE_KEY, reason: "unsure", result };
  return { key: result.choice, reason: "decided", result };
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** "furry 83% · femboy 8% · apple_guy 6% · architect 4%" */
export function distributionLine(result: DecisionResult): string {
  return sortedEntries(result.probabilities)
    .map(([id, p]) => `${id} ${p < 0.01 ? "<1%" : pct(p)}`)
    .join(" · ");
}

/** The public welcome message. Numbers are the model's, untouched; mock results say so. */
export function welcomeMessage(userId: string, d: RoleDecision): string {
  const lines = [`Welcome <@${userId}>. Circuit-VL looked at your PFP.`];
  if (d.reason === "default_avatar") {
    lines.push(`${UNCLASSIFIABLE_EMOJI} **${UNCLASSIFIABLE_NAME.toUpperCase()}**`, pickFrom(DEFAULT_AVATAR_MESSAGES));
    return lines.join("\n");
  }
  const r = d.result;
  if (r.mock) lines.unshift("⚠️ MOCK MODE: these numbers are fake, not Circuit-VL output.");
  if (d.reason === "unsure") {
    lines.push(
      `${UNCLASSIFIABLE_EMOJI} **${UNCLASSIFIABLE_NAME.toUpperCase()}** (best guess ${r.choice} at only ${pct(r.probabilities[r.choice])})`,
      pickFrom(UNSURE_MESSAGES),
    );
  } else {
    const opt = optionById(d.key);
    lines.push(`${opt?.emoji ?? ""} **${roleName(d.key).toUpperCase()}** (${pct(r.probabilities[r.choice])})`, `“${pickMessage(d.key)}”`);
  }
  lines.push(`-# ${distributionLine(r)} · one forward pass, ${r.outputTokens ?? 0} tokens generated`);
  return lines.join("\n");
}

/** One line for the console audit log. */
export function logLine(who: string, d: RoleDecision): string {
  if (d.reason === "default_avatar") return `${who} -> ${roleName(d.key)} (default avatar)`;
  const r = d.result;
  return `${who} -> ${roleName(d.key)} (${d.reason}; ${distributionLine(r)}; ${Math.round(r.latencyMs)} ms; model ${r.model})`;
}
