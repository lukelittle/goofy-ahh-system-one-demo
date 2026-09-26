import type { GuildMember } from "discord.js";

import { DEFAULT_MIN_INTERVAL_MS } from "@/config/discord";
import { classifyImageDataUri } from "@/lib/circuit";
import type { DecisionResult } from "@/lib/types";

import { decideRole, type RoleDecision } from "./decide";

/**
 * Classifies a member's PFP with the same single System One request the
 * website makes (src/lib/circuit.ts): the avatar is the state, the four
 * archetypes are the options, and nothing is generated.
 */

/** One call at a time, spaced out, so a join wave or a /trueup stays inside the API's rate limit. */
class Throttle {
  private tail: Promise<unknown> = Promise.resolve();
  private last = 0;
  constructor(private minIntervalMs: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(async () => {
      const wait = this.last + this.minIntervalMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        this.last = Date.now();
      }
    });
    this.tail = next.catch(() => undefined);
    return next;
  }
}

const throttle = new Throttle(Number(process.env.CIRCUIT_MIN_INTERVAL_MS) || DEFAULT_MIN_INTERVAL_MS);

/**
 * Results keyed by avatar URL. The URL carries the avatar's hash, so a new PFP
 * is a new key. This keeps /trueup from re-asking about pictures it has already
 * judged; `force` skips it.
 */
const cache = new Map<string, DecisionResult>();
const CACHE_MAX = 5000;

/** No custom avatar anywhere: Discord is showing one of its default ones. */
export function hasDefaultAvatar(member: GuildMember): boolean {
  return !member.avatar && !member.user.avatar;
}

/** The avatar Discord shows for this member in this server (server avatar first), as a static PNG. */
export function avatarUrl(member: GuildMember): string {
  return member.displayAvatarURL({ extension: "png", size: 512, forceStatic: true });
}

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`avatar download failed: HTTP ${res.status}`);
  const type = res.headers.get("content-type")?.split(";")[0] || "image/png";
  const bytes = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/**
 * Decide a member's role. Throws if Circuit-VL can't be reached or answers
 * something we can't vouch for; callers must then leave roles alone rather
 * than invent a decision.
 */
export async function classifyMember(member: GuildMember, opts: { force?: boolean } = {}): Promise<RoleDecision> {
  if (hasDefaultAvatar(member)) return decideRole(null, { defaultAvatar: true });
  const url = avatarUrl(member);
  let result = opts.force ? undefined : cache.get(url);
  if (!result) {
    result = await throttle.run(async () => classifyImageDataUri(await toDataUri(url)));
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(url, result);
  }
  return decideRole(result, { defaultAvatar: false });
}
