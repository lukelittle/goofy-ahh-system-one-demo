/**
 * Discord bot settings. The archetypes themselves (ids, descriptions sent to
 * the model) come from ./decision.ts, and the jokes from ./messages.ts; this
 * file only says how a decision becomes a server role.
 */

/** Role names, keyed by option id. The bot creates any that are missing. */
export const ROLE_NAMES: Record<string, string> = {
  architect: "Architect",
  apple_guy: "Apple Guy",
  femboy: "Femboy",
  furry: "Furry",
};

/** The fifth role: low-confidence decisions and default Discord avatars. */
export const UNCLASSIFIABLE_KEY = "unclassifiable";
export const UNCLASSIFIABLE_NAME = "Unclassifiable";
export const UNCLASSIFIABLE_EMOJI = "❓";

/**
 * If the top option's probability is below this, the member gets
 * Unclassifiable instead. The threshold is applied by our code, not the model:
 * this is the "decide with code over calibrated probabilities" half of a
 * System One setup.
 */
export const MIN_ROLE_PROBABILITY = 0.5;

/** Show the archetype roles as separate groups in the member list. */
export const HOIST_ROLES = true;

/** Minimum gap between Circuit-VL calls. The free tier allows 60 questions a minute. */
export const DEFAULT_MIN_INTERVAL_MS = 1100;
