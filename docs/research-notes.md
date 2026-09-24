# Research notes: how Circuit-VL actually works

Written before the integration was built, so the code and the explanations
match what the model does rather than what a generic VLM does. Everything
below comes from primary sources by the model's author, James Barney, as of
24 September 2026:

- **Model card**: [jbarney/circuit-vl-4b](https://huggingface.co/jbarney/circuit-vl-4b).
  The build environment for this repo could not reach huggingface.co directly
  (egress policy), so we read the model card's text through search-engine
  extracts. Every card claim used here is also backed by the author's source
  repositories below, which we cloned and read in full.
- **Server and training harness**: [Barneyjm/circuit](https://github.com/Barneyjm/circuit)
  at commit `7ecfa5b`. Key files: `s1proto/template.py`, `s1proto/scorer.py`,
  `s1proto/media.py`, `s1proto/schema.py`, `s1proto/service.py`,
  `deploy/modal_app.py`, `docs/cold-eval.md`.
- **SDK**: [Barneyjm/decision-circuits](https://github.com/Barneyjm/decision-circuits)
  at commit `9192580` (0.5.5). Key files: `README.md`, `docs/concepts.md`,
  `src/decision_circuits/backends/systemone.py`, `src/decision_circuits/media.py`,
  `examples/12_images_and_audio.py`, `gateway/worker.js`.

## What a "System One" model is

The author's definition (circuit README; decision-circuits docs): a model
that answers **typed questions about a state** with **calibrated probability
distributions**, in **one forward pass**, with **no text generation**. The
name comes from Kahneman's System 1 / System 2. The contract is TypeSafe's
`POST /v1/systemone` (their hosted model is Jev); the Circuit family is an
open-weights implementation of the same contract.

The Circuit family: `circuit-1.7b` (Qwen3-1.7B-Base), `circuit-8b`
(Qwen3-8B-Base), `circuit-vl-4b` (Qwen3-VL-4B-Instruct, images),
`circuit-audio-7b` (Qwen2-Audio-7B-Instruct, sound).

## circuit-vl-4b, as built

| Part | What it is | Source |
|---|---|---|
| Base | Qwen/Qwen3-VL-4B-Instruct, Apache 2.0 | model card; `deploy/modal_app.py` |
| Vision encoder | Frozen, untouched | model card |
| Adapter | LoRA rank 16, alpha 32, on the **language model's** attention and MLP projections only, ~33M params | model card |
| Readout | Pointer head: `q = W_q·h_decide`, `k_i = W_k·h_</opt_i>`, `logit_i = k_i·q / √d`, d = 256 | `s1proto/media.py` `PointerHead`; `HEAD_DIM = 256` |
| Output | softmax(logit / T), T a per-question-type temperature fitted on validation | `s1proto/scorer.py` `MultimodalScorer.score` |
| Training | Cross-entropy against outcome labels; labels computed by code or humans, never by another model | circuit README; model card |
| Data (v1 card) | Vision grid: 1,083 train / 117 validation items; rendered receipts, bar charts, tables, forms, shape scenes; ~5% rendered ambiguous with soft 0.5 labels | model card |
| Data (v2) | Adds real Open Images V7 photos (present / classify / negation cells), 1,408 training items, 16 cells | `docs/cold-eval.md` |
| Served revision | `v1.2` on the hosted API (at the time of reading) | `deploy/modal_app.py` |

## How a request becomes a distribution

1. **Request** (`s1proto/schema.py`):
   ```json
   {"state": {"image": "data:image/jpeg;base64,..."},
    "model": "circuit-vl-4b",
    "questions": {"archetype": {"type": "choice",
                                "instructions": "Which archetype ...?",
                                "criteria": {"architect": "desc", "apple_guy": "desc", ...}}}}
   ```
   A media state is `{"image": <data URI or URL>, "text"?: caption}`. With no
   caption the server uses `"See the image."` (`split_media_state`). Unknown
   top-level keys are rejected (`extra="forbid"`). Image states support
   `noul`, `choice` and `score` questions; the v2 types (`multi`, `locate`,
   `rank`, `match`) are text-only.

2. **Rendering** (`s1proto/template.py`, pointer layout):
   ```
   <state caption>

   Question (pick exactly one option):
   <instructions>
   <|box_start|>architect — <description><|box_end|>
   <|box_start|>apple_guy — <description><|box_end|>
   ...
   <|fim_middle|>
   ```
   `<|box_start|>`, `<|box_end|>` are the option delimiters; `<|fim_middle|>`
   is the decide token. They are Qwen reserved tokens; user text is sanitized
   (`sanitize()`) so it cannot forge them.

3. **Image** (`s1proto/media.py` `chat_text`, `encode`): the rendered text is
   wrapped in the base model's chat template with an image part in front
   (`add_generation_prompt=False`), and the Qwen3-VL processor expands the
   image into vision tokens.

4. **One forward pass** (`hidden_states`): encoder + projector + LoRA language
   model, returning hidden states **without** the LM head (the vocabulary
   logits are never computed; the comment notes they would be the largest
   activation and are unused).

5. **Readout** (`head_logits`, `PointerHead.forward`): gather the hidden state
   at every `<|box_end|>` position (keys) and at the last `<|fim_middle|>`
   (query), scaled dot product, mask padding, softmax with temperature. The
   scorer checks it found exactly as many delimiters as options.

6. **Response** (`s1proto/service.py` `build_answers`):
   ```json
   {"model": "...", "answers": {"archetype": {"type": "choice", "choice": "furry",
     "probabilities": {"architect": 0.02, ...}, "confidence": 0.71}},
    "usage": {"input_tokens": 612, "output_tokens": 0}, "request_id": "..."}
   ```
   `choice` is the argmax. `confidence` is `1 − H(p)/log N`. The service sets
   `x-s1-latency-ms`, `x-request-id` and `x-s1-input-tokens` headers; the
   hosted gateway adds `x-circuit-model`, `x-circuit-served-by`,
   `x-circuit-rate`.

## Why no autoregressive generation is needed

The answer space is the option list. The head produces one logit per option
position, so the output is exactly |options| numbers. There is no vocabulary
to sample from, nothing to decode, and nothing to parse. The only compute is
the prefill. `output_tokens` is 0 by construction.

## Hosted API behaviour that matters to the integration

- Endpoint `https://api.decisioncircuits.com/v1/systemone`, `Authorization: Bearer dc-...`; free keys at decisioncircuits.com.
- Scale-to-zero GPUs: the first call after a quiet spell waits about a minute;
  warm calls take under a second (`examples/12_images_and_audio.py`). The SDK
  retries 429/502/503/504/524 for up to 240 s, honouring `Retry-After`.
- Free tier: 60 questions a minute (`gateway/worker.js`).
- CORS is open, but we still call it from our server so the key is never in the browser.

## Documented results and caveats (used in the Limitations section)

- v1 (model card, `docs/cold-eval.md`): 300 held-out grid items, 98.3% / ECE 0.018 vs the raw base's letter logits 96.0% / 0.041; 90 ms/item on an A6000.
- v1 card caveats: grid holds out items, not structure; training set is small; on items rendered to be undecidable, mean confidence 0.93 where it should be near 0.5; "calibration on ambiguity is the open problem".
- v2 (`docs/cold-eval.md`): 390 held-out items 96.4% / ECE 0.036 (base 92.6% / 0.079); real photos 89.5% / 0.105 (base 81.4% / 0.192); ambiguous mean confidence 0.88.
- POPE (COCO object presence): 0.923 / ECE 0.049 vs untuned base 0.913 / 0.072.
- Option order: 3.6% top-answer flips over 4 orders on 140 items for v1.1; an "options side by side" variant got 0.0% in the author's test (not published at time of reading).
- Rubric probe (text models): Circuit models follow option descriptions; removing descriptions lowers accuracy.
- Family-level: calibration degrades off distribution (text models: ECE .11–.31 on unseen sets vs .01–.05 on the grid).

## Integration decisions that follow

- One `choice` question, options = our four archetypes with visual descriptions.
- No caption, no second model, no JSON-output prompt.
- The Next.js server calls the endpoint (keeps the key server-side), retries like the SDK, and **validates** that the returned options match the ones sent and that probabilities sum to 1 before showing anything.
- Nerd Mode's "sequence" view is a reconstruction from `template.py`, labelled as such.
- Nerd Mode's "score" column is `log p`, which equals the temperature-scaled logit minus a shared constant; the API does not return raw logits, so we say so.
