/**
 * The jokes. Shown after the decision; never sent to the model.
 * Keyed by option id from src/config/decision.ts. Add as many as you like per
 * option; one is picked at random per result.
 */
export const RESULT_MESSAGES: Record<string, string[]> = {
  neckbeard: [
    "Has opinions about whether this should have been an event-driven architecture.",
    "Runs Arch, by the way.",
    "Has corrected a stranger's pronunciation of GIF in the last 30 days.",
  ],
  stressed_dev: [
    "Has explained why 8 GB of unified memory is different.",
    "It works on their machine. Their machine is on fire.",
    "Currently reading a 400-comment Jira ticket titled \"quick question\".",
  ],
  femboy: [
    "The CI pipeline has been configured with :3.",
    "Thigh-high socks: provisioned. Rust compiler: also provisioned.",
    "Commit messages contain more tildes than code~",
  ],
  furry: [
    "Enterprise-grade fox detection successful.",
    "Paws-itively classified with a calibrated probability distribution.",
    "The fursuit has better uptime than production.",
  ],
};

/** Shown when the top option is below this probability. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;
export const LOW_CONFIDENCE_MESSAGE =
  "The model is not very sure. Neither are we. That is what the distribution is for.";

export function pickMessage(optionId: string): string {
  const list = RESULT_MESSAGES[optionId];
  if (!list || list.length === 0) return "";
  return list[Math.floor(Math.random() * list.length)];
}

/** Discord: the member gets Unclassifiable because the model wasn't sure enough. */
export const UNSURE_MESSAGES = [
  "The model looked, shrugged, and returned a very flat distribution.",
  "Too complex for four boxes. Respect.",
];

/** Discord: the member still has the default Discord avatar. */
export const DEFAULT_AVATAR_MESSAGES = ["No PFP, no archetype. Set one and I'll look again."];

export function pickFrom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)] ?? "";
}
