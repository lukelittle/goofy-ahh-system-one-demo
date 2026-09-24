/**
 * The jokes. Shown after the decision; never sent to the model.
 * Keyed by option id from src/config/decision.ts. Add as many as you like per
 * option; one is picked at random per result.
 */
export const RESULT_MESSAGES: Record<string, string[]> = {
  architect: [
    "Has opinions about whether this should have been an event-driven architecture.",
    "Will draw a box-and-arrow diagram of your lunch order.",
    "Has said \"it depends\" in a meeting and meant it as a complete answer.",
  ],
  apple_guy: [
    "Has explained why 8 GB of unified memory is different.",
    "Owns a dongle for the dongle.",
    "Calls a laptop \"a joy to use\" without irony.",
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
