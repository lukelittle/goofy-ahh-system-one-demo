/**
 * The bounded decision we put to Circuit-VL.
 *
 * Everything the model is allowed to answer is defined here. The option ids
 * become the keys of a System One `choice` question's `criteria`, and each
 * description is rendered next to its option name inside the model's input
 * sequence (see src/lib/pointerLayout.ts). The model cannot answer anything
 * that is not in this list: the readout head produces exactly one score per
 * option, so there is no "other text" for it to emit.
 *
 * The author's rubric probe (circuit docs/cold-eval.md, "Does it read the
 * rubric?") found that Circuit models do read these descriptions, and that
 * accuracy falls when they are removed. So the descriptions are part of the
 * question, not decoration. Keep them about what is VISIBLE in the image.
 */

export const QUESTION_ID = "archetype";

export const QUESTION =
  "Which archetype best describes the visual presentation of this profile picture?";

export interface ArchetypeOption {
  /** Sent to the model as the option name. Also the key in the returned probabilities. */
  id: string;
  /** Shown in the UI only. */
  label: string;
  emoji: string;
  /** Sent to the model as the option's criteria (rendered as "id — description"). */
  description: string;
}

export const OPTIONS: ArchetypeOption[] = [
  {
    id: "architect",
    label: "Architect",
    emoji: "🏗️",
    description:
      "Enterprise, cloud or software architect aesthetic: architecture diagrams, cloud or AWS imagery, Kubernetes, terminals, servers and infrastructure, serious corporate engineering headshot energy.",
  },
  {
    id: "apple_guy",
    label: "Apple Guy",
    emoji: "🍎",
    description:
      "Minimalist Apple-style product and design tech aesthetic: MacBook or iPhone imagery, clean minimalist photography, white space, polished product-design energy.",
  },
  {
    id: "femboy",
    label: "Femboy",
    emoji: "🎀",
    description:
      "Cute, feminine or androgynous internet aesthetic: anime-adjacent imagery, pastel colors, cat ears, gaming and internet-culture styling.",
  },
  {
    id: "furry",
    label: "Furry",
    emoji: "🦊",
    description:
      "Anthropomorphic animal character: a fursona, furry artwork, an animal avatar with human characteristics, fursuits or furry fandom imagery.",
  },
];

/**
 * Which hosted model to ask. circuit-vl-4b is the image member of the Circuit
 * family; the same request shape works against the open-weights server.
 */
export const DEFAULT_MODEL = "circuit-vl-4b";

export function optionById(id: string): ArchetypeOption | undefined {
  return OPTIONS.find((o) => o.id === id);
}
