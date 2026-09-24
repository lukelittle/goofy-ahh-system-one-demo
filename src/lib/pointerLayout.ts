/**
 * A reconstruction, for teaching, of the token sequence the Circuit server
 * builds from our request. We never send this string; the server renders it.
 * We rebuild it here so Nerd Mode can show where the options physically sit.
 *
 * Source: `s1proto/template.py` (`_assemble`, `_pointer_block`, pointer
 * layout) and `s1proto/media.py` (`chat_text`) in
 * https://github.com/Barneyjm/circuit. In the pointer layout:
 *
 *   - every option is wrapped in `<|box_start|>` ... `<|box_end|>`
 *   - the sequence ends in the decide token `<|fim_middle|>`
 *   - these are Qwen reserved tokens that do not occur in ordinary text, and
 *     user text is sanitized so it cannot forge them
 *
 * For a vision model the rendered text is placed in the base model's chat
 * template after an image slot, which the processor expands into the vision
 * encoder's image tokens. We collapse those into one placeholder; the exact
 * chat-template framing is approximate, the option/decide layout is not.
 */

import type { ChoiceQuestion } from "./types";

export const OPT_START = "<|box_start|>";
export const OPT_END = "<|box_end|>";
export const DECIDE = "<|fim_middle|>";
export const CHOICE_LEAD = "Question (pick exactly one option):";
/** What the server uses as the text part of an image state when we send none. */
export const DEFAULT_IMAGE_CAPTION = "See the image.";

export type Segment =
  | { kind: "frame"; text: string }
  | { kind: "image"; text: string }
  | { kind: "text"; text: string }
  | { kind: "optStart"; text: string }
  | { kind: "optBody"; text: string; option: string }
  | { kind: "optEnd"; text: string; option: string }
  | { kind: "decide"; text: string };

/** The sequence as labelled segments, so the UI can colour the parts the head reads. */
export function pointerSegments(question: ChoiceQuestion, caption = DEFAULT_IMAGE_CAPTION): Segment[] {
  const segs: Segment[] = [
    { kind: "frame", text: "<|im_start|>user\n" },
    { kind: "image", text: "<|vision_start|>[ image tokens from the frozen vision encoder ]<|vision_end|>" },
    { kind: "text", text: `${caption}\n\n${CHOICE_LEAD}\n${question.instructions}\n` },
  ];
  const names = Object.keys(question.criteria);
  for (const name of names) {
    const desc = question.criteria[name];
    segs.push({ kind: "optStart", text: OPT_START });
    segs.push({ kind: "optBody", text: desc ? `${name} — ${desc}` : name, option: name });
    segs.push({ kind: "optEnd", text: OPT_END, option: name });
    segs.push({ kind: "text", text: "\n" });
  }
  segs.push({ kind: "decide", text: DECIDE });
  segs.push({ kind: "frame", text: "<|im_end|>" });
  return segs;
}
