# Goofy Ahh System One Demo

> Teaching serious AI concepts with extremely unserious classification problems.

Upload a profile picture. A **System One** vision model,
[`jbarney/circuit-vl-4b`](https://huggingface.co/jbarney/circuit-vl-4b), decides
which of four ridiculous internet archetypes the image's visual presentation
most resembles:

```
architect · apple_guy · femboy · furry
```

The categories are a joke. The mechanism is the point: **no text is generated
anywhere in this app.** The model gets the image, the question and the four
options, runs one forward pass, and a small readout head turns that into one
probability per option. That is a different way of using a model from "ask an
LLM to reply in JSON", and this repo exists to show and explain the difference.

---

## Contents

1. [WTF is this?](#1-wtf-is-this)
2. [Try it](#2-try-it)
3. [What is a System One decision model?](#3-what-is-a-system-one-decision-model)
4. [How Circuit-VL works](#4-how-circuit-vl-works)
5. [Circuit-VL vs a conventional generative VLM](#5-circuit-vl-vs-a-conventional-generative-vlm)
6. [Architecture](#6-architecture)
7. [What happens during inference?](#7-what-happens-during-inference)
8. [Why bounded decisions are interesting](#8-why-bounded-decisions-are-interesting)
9. [Real-world consulting use cases](#9-real-world-consulting-use-cases)
10. [Limitations](#10-limitations)
11. [Running locally](#11-running-locally)
12. [Configuration](#12-configuration)
13. [Adding new choices](#13-adding-new-choices)
14. [Visual identity (and the meme)](#14-visual-identity-and-the-meme)
15. [References / further reading](#15-references--further-reading)

---

## 1. WTF is this?

A teaching artifact for engineers and technology consultants who know
conventional LLMs and have not yet met a model that answers **without
generating**.

Most "AI classifiers" built today look like this: send an image to a big
generative model with a prompt that says *"reply with one of these four
words"*, then parse whatever comes back. That works. It is also not the only
option.

Circuit-VL is a *decision model*. You hand it the image, the question **and the
list of allowed answers**. It scores every answer you listed and gives you a
probability distribution over them. It cannot produce an answer you did not
list, there is nothing to parse, and the response literally reports
`output_tokens: 0`.

If you leave this repo able to explain that sentence to a colleague, it worked.

The page has three modes:

| Mode | For |
|---|---|
| **Default** | Upload, get a verdict, a joke, and the model's actual probabilities. |
| **Nerd Mode** | The request, the reconstructed token sequence with the positions the head reads highlighted, option → score → probability, latency, model version, raw response, and an option-order check. |
| **Teaching Mode** | The same story in seven projector-friendly steps with arrow-key / clicker navigation: image → question → the ONLY choices → send → "we did not ask it to generate" → probabilities → decision. |

Below the demo, the page has a long section called
**"Okay, but what actually happened?"** that mirrors this README.

## 2. Try it

```bash
git clone https://github.com/lukelittle/goofy-ahh-system-one-demo
cd goofy-ahh-system-one-demo
npm install
cp .env.example .env.local        # add CIRCUIT_API_KEY (free: https://decisioncircuits.com/#api)
npm run dev                       # http://localhost:3000
```

The first request after a quiet spell can take about a minute: the hosted
GPUs scale to zero and have to wake up. The app retries through that and
tells you it is doing so. Warm requests take well under a second.

No key and no network? `CIRCUIT_MOCK=1 npm run dev` runs the UI with
**fake, hash-derived numbers** under a red "MOCK MODE: NOT Circuit-VL output"
banner. Do not present mock output as a model result.

## 3. What is a System One decision model?

The term comes from the Circuit author (and TypeSafe, whose API contract the
Circuit models implement). A System One model:

> answers **typed questions about a state** with **calibrated probability
> distributions**, in **one forward pass**, with **no text generation**.

- **State**: the thing being judged. Here, an image.
- **Typed question**: `noul` (yes/no → P(yes)), `choice` (pick one of named
  options → a distribution), or `score` (ordered levels → a distribution and
  an expected level). This demo uses one `choice` question.
- **Calibrated**: trained so that "0.8" should mean "right about 80% of the
  time" *on the distribution it was trained for*. More on that in
  [Limitations](#10-limitations).
- **One forward pass**: the model reads everything once. There is no decoding
  loop.

The name is from Daniel Kahneman's *Thinking, Fast and Slow*: System 1 is fast,
intuitive judgment; System 2 is slow, deliberate reasoning. A chat model
writing a paragraph about your picture is doing something closer to System 2.

The **Circuit** family is James Barney's set of open-weights System One models:

| Model | Base | Modality |
|---|---|---|
| circuit-1.7b | Qwen3-1.7B-Base | text |
| circuit-8b | Qwen3-8B-Base | text |
| **circuit-vl-4b** | **Qwen3-VL-4B-Instruct** | **images** |
| circuit-audio-7b | Qwen2-Audio-7B-Instruct | audio |

They are served behind the same `POST /v1/systemone` contract, hosted at
decisioncircuits.com or self-hosted with the
[circuit](https://github.com/Barneyjm/circuit) server. The companion SDK,
[decision-circuits](https://github.com/Barneyjm/decision-circuits), puts
deterministic *gates* (thresholds, argmax with a confidence floor, "escalate
when unsure") on top of those probabilities.

## 4. How Circuit-VL works

From the model card and the open-source server
([`s1proto/`](https://github.com/Barneyjm/circuit/tree/main/s1proto)).
The full research trail, with file references, is in
[`docs/research-notes.md`](docs/research-notes.md).

### The pieces

| Part | What it is |
|---|---|
| **Base model** | Qwen/Qwen3-VL-4B-Instruct (Apache 2.0), a general vision-language model. |
| **Vision encoder** | **Frozen.** The part that turns pixels into image tokens is untouched. |
| **LoRA adapter** | Low-rank update, rank 16, alpha 32, on the *language model's* attention and MLP projections only. About 33M trainable parameters on a 4B model. |
| **Pointer readout head** | Two small projection matrices (`W_q`, `W_k`, width 256). This replaces text generation. |
| **Temperature** | A per-question-type scalar fitted on validation data, applied before softmax. |
| **Training** | Cross-entropy against outcome labels on a "vision grid" (rendered receipts, charts, tables, forms, shape scenes, and in v2 real Open Images photos). Labels come from code or humans, never from another model. |

### How a question is laid out

The server renders one token sequence per question. For an image state and a
`choice` question it looks like this (reconstructed from
[`template.py`](https://github.com/Barneyjm/circuit/blob/main/s1proto/template.py)
and [`media.py`](https://github.com/Barneyjm/circuit/blob/main/s1proto/media.py);
the chat-template framing is approximate):

```text
<|im_start|>user
<|vision_start|>[ image tokens from the frozen vision encoder ]<|vision_end|>See the image.

Question (pick exactly one option):
Which archetype best describes the visual presentation of this profile picture?
<|box_start|>architect — Enterprise, cloud or software architect aesthetic: ...<|box_end|>
<|box_start|>apple_guy — Minimalist Apple-style product and design tech aesthetic: ...<|box_end|>
<|box_start|>femboy — Cute, feminine or androgynous internet aesthetic: ...<|box_end|>
<|box_start|>furry — Anthropomorphic animal character: ...<|box_end|>
<|fim_middle|><|im_end|>
```

- `<|box_start|>` / `<|box_end|>` are **option delimiters**.
- `<|fim_middle|>` is the **decide token**.
- All three are Qwen reserved tokens that do not occur in ordinary text; the
  server sanitizes user text so it cannot forge them.
- There are no A/B/C letter labels, so there is no 26-option cap and no
  letter-position cue.

### How it answers

One forward pass over the whole sequence, through the vision encoder and the
LoRA-adapted language model. The server takes the hidden states and **never
computes the vocabulary logits at all** (`hidden_states()` skips the LM head).
Then the pointer head reads two kinds of position:

```text
q        = W_q · h(<|fim_middle|>)            the query, from the decide token
k_i      = W_k · h(<|box_end|> of option i)   one key per option
logit_i  = (k_i · q) / √256
p        = softmax(logit / T)
```

Because attention runs over the whole sequence, the hidden state at an
option's closing delimiter has "seen" the image, the question and that option,
and the decide token has seen everything. The head compares them. Softmax turns
the four scores into the four probabilities you see on screen. The server
returns them with the argmax as `choice` and `1 − H(p)/log N` as `confidence`.

```text
                 IMAGE
                   │
                   ▼
          ┌─────────────────┐
          │ Vision Encoder  │   frozen (Qwen3-VL)
          └────────┬────────┘
                   │  image tokens + question + <opt>architect</opt> … <decide>
                   ▼
          ┌─────────────────┐
          │ Language Model  │   Qwen3-VL-4B language model
          │ + LoRA Adapter  │   rank 16, ~33M trained params
          └────────┬────────┘
                   │  hidden states at each </opt> and at <decide>
                   ▼
          ┌─────────────────┐
          │ Pointer Readout │   score_i = key(option_i) · query(decide)
          └────────┬────────┘
                   │  softmax
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼
    architect  apple_guy   femboy     furry
      0.xx       0.xx       0.xx       0.xx
```

*Simplified conceptual diagram. In reality this is one token sequence; the
head reads specific positions in it.*

### Why no autoregressive generation is needed

The answer space is the option list you supplied. The head emits exactly one
number per option, so the "output" is already complete after one pass. There
is no vocabulary to sample from, no stop condition, no decoding loop, and no
text to parse.

## 5. Circuit-VL vs a conventional generative VLM

### A generative LLM, briefly

A language model reads **tokens** (sub-word chunks, each an id in a vocabulary
of ~100k–250k) and is trained on **next-token prediction**: given a sequence,
output a probability for every vocabulary entry being next. To get a response
you **generate autoregressively**: run the prompt (the *prefill*), pick a token,
append it, run again, until an end token.

```text
Prompt
   │
   ▼
┌──────┐
│ LLM  │──▶ token ──┐
└──────┘            │  append, run again
   ▲                │
   └────────────────┘
   ▼
token ▶ token ▶ token ▶ token ▶ … ▶ <end>
   │
   ▼
generated response (free text)
```

A VLM is the same with an image encoder in front. When an application needs a
decision rather than prose, developers ask for structure (*"respond with JSON
containing one of these values"*), often with JSON mode or constrained
decoding, and then **parse and validate** what comes back:

```text
Image
   │
   ▼
Generative VLM ◀── "Please return one of: architect | apple_guy | femboy | furry"
   │
   ▼
Generated text      {"archetype": "furry"}   or   "Sure! This looks like a furry."
   │
   ▼
Parse / validate    is it JSON? is the value allowed? retry if not
   │
   ▼
Application decision
```

**This works**, and plenty of production systems do it. We are not arguing
generative models are bad. We are showing a different inference paradigm.

### Side by side

```text
Generative VLM                Circuit-VL

IMAGE                         IMAGE + QUESTION + OPTIONS
  ↓                             ↓
MODEL                         MODEL
  ↓                             ↓
GENERATE TOKENS               SCORE BOUNDED OPTIONS
  ↓                             ↓
TEXT ANSWER                   PROBABILITY DISTRIBUTION
  ↓                             ↓
PARSE ANSWER                  DECISION
  ↓
DECISION
```

## **Generation vs. Decision**

| | Generative VLM + "return JSON" | Circuit-VL |
|---|---|---|
| Output | Any sequence of tokens | One probability per supplied option |
| Where the options live | In the prompt, as a request | In the input, as the only things the head can score |
| Invalid answers | Possible; parse, validate, retry | Not representable |
| Confidence | Stated (uncalibrated) or from token log-probs | The softmax, trained for calibration |
| Forward passes | 1 prefill + 1 per output token | 1 (`output_tokens: 0`) |
| Explains itself in words | Yes (faithfulness is another question) | No; you can probe it, not ask it |
| Open-ended questions | Yes | No: options must be known up front |

**A fair footnote.** You *can* get a distribution out of a generative model
without generating: letter the options A–D and read the next-token
probabilities of "A"…"D". The Circuit author's own baseline is exactly that
on the raw Qwen3-VL-4B ("letter logits"). On the author's vision grid v2 it
scores 92.6% / ECE 0.079 against circuit-vl-4b's 96.4% / ECE 0.036. The pointer
head drops the letter labels, the option cap and the letter-position cues,
and is trained for the job.

## 6. Architecture

```text
Browser (Next.js client)                      Next.js server                      System One endpoint
─────────────────────────                     ──────────────                      ───────────────────
MemeGrid ─▶ fileToDataUri()                   POST /api/classify                  POST /v1/systemone
            (resize ≤896px, JPEG)             │ validate image data URI           (hosted Circuit API
            │                                 │ buildRequest():                    or local circuit server)
            ▼                                 │   state    = {image}               │
classifyImage(uri) ──────── JSON ───────────▶ │   questions = {archetype: choice}  │  render pointer layout
                                              │ postWithRetry() ─────────────────▶ │  one forward pass
                                              │   (429/5xx cold-start retries)     │  pointer head + softmax
                                              │ ◀──────────────────────────────── │  {answers, usage, model}
                                              │ validateAnswer(): options match,
                                              │   probs in [0,1], sum to 1
DecisionResult ◀──────────────────────────── │ adapt to DecisionResult
   │
   ├─▶ MemeGrid (winner panel) / ResultCard / ProbabilityBars
   ├─▶ NerdMode (SequenceView, scores, raw)
   └─▶ TeachingMode (7 steps)
```

| File | Role |
|---|---|
| `src/config/decision.ts` | The question and the options (ids, descriptions sent to the model, UI labels). |
| `src/config/messages.ts` | The jokes. Never sent to the model. |
| `src/lib/systemone.ts` | **The integration.** Builds the System One request, calls it with retries, validates the answer, adapts it to `DecisionResult`. Server-only. |
| `src/app/api/classify/route.ts` | The route the browser calls. Keeps the API key on the server. `GET` reports configuration. |
| `src/lib/classifyImage.ts` | `classifyImage(image): Promise<DecisionResult>` for the UI, plus client-side resizing. |
| `src/lib/pointerLayout.ts` | Rebuilds the token sequence for Nerd Mode (teaching only; never sent). |
| `src/lib/math.ts` | `log p` scores and normalised-entropy confidence. |
| `src/lib/mock.ts` | Mock mode. Loudly labelled. |
| `src/components/*` | UI: `Demo`, `MemeGrid` (upload target and result grid), `ResultCard`, `ProbabilityBars`, `NerdMode`, `SequenceView`, `TeachingMode`, `Education`, `GenerationRace`. |

The contract we adapt to (`DecisionResult` in `src/lib/types.ts`):

```ts
interface DecisionResult {
  choice: string;                          // argmax, chosen by the server
  probabilities: Record<string, number>;   // one per supplied option, sums to 1
  confidence: number;                      // 1 − H(p)/log N
  latencyMs: number;                       // our server → endpoint → back, incl. retries
  serverLatencyMs: number | null;          // x-s1-latency-ms when the server reports it
  model: string;                           // as reported by the server (run + revision)
  outputTokens: number | null;             // 0: nothing was generated
  optionOrder: string[];                   // order sent (it is part of the input)
  request: unknown;                        // what we sent (image shortened)
  raw: unknown;                            // the untouched response
  mock: boolean;
  // …plus endpoint, requestId, inputTokens, attempts, headers
}
```

We call the HTTP contract directly from TypeScript rather than through the
Python SDK: the request is small, the contract is documented in the server's
`schema.py`, and it keeps the demo to one runtime. The request body is
identical to what the SDK's `SystemOne` backend sends for an `Image` state.

## 7. What happens during inference?

For one upload:

1. **Browser.** The image is decoded, scaled so its longest side is ≤ 896 px,
   and re-encoded as JPEG. (Our choice: Qwen3-VL's image-token count grows with
   resolution, and a PFP does not need 12 megapixels.)
2. **Our server** builds exactly this request:

   ```json
   {
     "state": { "image": "data:image/jpeg;base64,..." },
     "model": "circuit-vl-4b",
     "questions": {
       "archetype": {
         "type": "choice",
         "instructions": "Which archetype best describes the visual presentation of this profile picture?",
         "criteria": {
           "architect": "Enterprise, cloud or software architect aesthetic: ...",
           "apple_guy": "Minimalist Apple-style product and design tech aesthetic: ...",
           "femboy":    "Cute, feminine or androgynous internet aesthetic: ...",
           "furry":     "Anthropomorphic animal character: ..."
         }
       }
     }
   }
   ```

   There is no caption (the server uses its default, "See the image."), no
   system prompt, no "respond with".
3. **The Circuit server** validates the request, renders the pointer-layout
   sequence above, wraps it in Qwen3-VL's chat template with the image in front,
   and runs **one forward pass**. The vision encoder turns the image into
   tokens; the LoRA-adapted language model processes image + text; the pointer
   head scores each option's `<|box_end|>` against the `<|fim_middle|>` decide
   token; temperature and softmax give the distribution.
4. **The response**:

   ```json
   {
     "model": "lora:circuit-vl-4b@v1.2",
     "answers": {
       "archetype": {
         "type": "choice",
         "choice": "furry",
         "probabilities": { "architect": 0.02, "apple_guy": 0.06, "femboy": 0.16, "furry": 0.76 },
         "confidence": 0.52
       }
     },
     "usage": { "input_tokens": 612, "output_tokens": 0 },
     "request_id": "…"
   }
   ```

   *(Illustrative numbers. The model string is whatever the server reports.)*
5. **Our server checks** the answer before anyone sees it: it must be a
   `choice` answer, its option set must equal the one we sent, every
   probability must be in [0, 1], and they must sum to 1. If not, the UI shows
   an error. **It never shows numbers it cannot vouch for.**
6. **The UI** shows the argmax, the joke for that option, and the bars, using
   the returned probabilities unmodified.

## 8. Why bounded decisions are interesting

If the task is fundamentally a **bounded decision**, do we always want a
generative model producing arbitrary tokens?

What you get from a decision model, where it fits:

- **The output contract is the model's shape.** No parser, no retry loop, no
  "the model said *Furry.* with a full stop" bug.
- **A distribution, not a verdict.** Threshold it; send near-ties to a human;
  write that policy as code you can version and test offline. The
  decision-circuits SDK is built for exactly this (`Q("x") >= 0.7` with an
  uncertainty band, `argmax(..., min_confidence=0.3)`, `on_uncertain="escalate"`).
- **Predictable cost and latency.** One prefill, no decoding loop. The author
  measured ~90 ms per item for circuit-vl-4b on an A6000.
- **Small, open, auditable.** Apache-2.0 base, published adapter and head, a
  harness that reproduces the evaluations.

What it costs you:

- **You must know the options up front.** Open-ended extraction, summaries and
  explanations are generative work.
- **Softmax always sums to 1.** If "none of these" is possible it has to be an
  option. This demo deliberately has none: upload a sandwich and it will still
  be one of four.
- **A 4B model trained on a small, specific dataset** is not a frontier model.
  Far from its training data, a large general model may simply be more accurate.
- **No reasoning trace.** You can probe it (change the input, re-ask, compare)
  but not ask it why.
- **Research-stage tooling.** The SDK is 0.x/alpha and the model family is new.

The honest consulting answer is "it depends, so measure": take a few hundred
labelled examples from the real task, run both approaches, and compare
accuracy, calibration, latency and cost.

## 9. Real-world consulting use cases

Swap the joke for a real label set; the architecture does not change.

```text
Goofy demo:           PFP                  → [architect, apple_guy, femboy, furry]
Document processing:  Document image       → [invoice, contract, purchase_order, other]
Manufacturing:        Part photo           → [normal, crack, corrosion, deformation]
Insurance:            Claim image          → [hail, collision, flood, other]
Operations:           Dashboard screenshot → [healthy, degraded, critical]
```

Patterns worth noticing:

- Each has an explicit `other`/fallback where one is plausible. Our demo does
  not, on purpose, to make the softmax point.
- Each is a *triage* decision whose downstream action is known (route, flag,
  escalate). That is where calibrated probabilities pay off: act
  automatically above a threshold, send the uncertain middle to a person.
- None of these are in circuit-vl-4b's training data either. A real engagement
  would evaluate on the client's own labelled data before trusting a
  threshold, and might fine-tune (the circuit repo includes the training
  scripts).

## 10. Limitations

**This is a joke classifier on an experimental research model.** It classifies
the *visual presentation of an image* into four made-up archetypes. It says
nothing about who a person is and should not be used to say anything about
anyone.

From the author's documentation (model card and
[`docs/cold-eval.md`](https://github.com/Barneyjm/circuit/blob/main/docs/cold-eval.md)):

- **Off distribution.** circuit-vl-4b was trained on rendered receipts, charts,
  tables, forms and shape scenes, plus (v2) a set of Open Images photos.
  Internet archetypes are not in there. Calibration is measured on the
  training distribution; here the probabilities are the model's scores, not a
  promise that "76%" means right 76% of the time.
- **Overconfidence on ambiguous inputs.** The model card reports that on items
  rendered to be undecidable (a blurred field under a comparison question) the
  model answers with mean confidence 0.93 where it should be near 0.5, and calls
  calibration on ambiguity "the open problem". The v2 evaluation still shows
  0.88 mean confidence on its ambiguous items.
- **Real photos are harder.** v2 grid: 96.4% / ECE 0.036 overall, but 89.5% /
  ECE 0.105 on the real-photo cells. POPE (COCO object presence): 92.3% / ECE
  0.049, about the same as the untuned base (91.3% / 0.072).
- **Small training set; held-out items, not held-out structure.** 1,083 training
  items in v1, 1,408 in v2.
- **Option order matters a little.** Options sit in the input sequence. The
  author measured 3.6% top-answer flips over four orderings for v1.1, mostly
  in classification and deliberately ambiguous items; an options-side-by-side
  variant reached 0% in their test. Nerd Mode's "re-ask reversed" button lets
  you check on your image.
- **Descriptions are part of the question.** The author's rubric probe found
  Circuit models follow option descriptions. Edit them and the numbers move.

And in general:

- **Probability is not correctness.** A bounded output can be confidently wrong.
- **Ambiguous inputs and domain mismatch** are where any model's numbers are
  least trustworthy, calibrated or not.
- **This is not a benchmark.** Nothing here shows Circuit is better than any
  other approach for any classification problem, including this one.

## 11. Running locally

### Against the hosted API (easiest)

```bash
npm install
cp .env.example .env.local
# set CIRCUIT_API_KEY=dc-...   (free key: https://decisioncircuits.com/#api)
npm run dev
```

### Against the open weights on your own GPU

The [circuit](https://github.com/Barneyjm/circuit) repo serves the same
contract. You need a machine that can hold Qwen3-VL-4B in bf16 (a CUDA GPU with
roughly 12 GB or more, or Apple silicon via MPS).

```bash
git clone https://github.com/Barneyjm/circuit && cd circuit
uv sync
# weights: adapter/, head.pt, config.json (the hosted API pins revision v1.2)
uv run hf download jbarney/circuit-vl-4b --revision v1.2 --local-dir runs/circuit-vl-4b
S1_MODEL=lora:runs/circuit-vl-4b uv run python -m s1proto     # POST /v1/systemone on :8901
```

The base model downloads from the Hub on first start. Then, in this repo:

```bash
CIRCUIT_URL=http://localhost:8901/v1/systemone npm run dev
```

No key is needed locally: the server accepts any bearer token unless you set
`S1_API_KEY` on it, and this app sends a placeholder token when
`CIRCUIT_API_KEY` is empty.

### Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## 12. Configuration

| Variable | Default | Meaning |
|---|---|---|
| `CIRCUIT_API_KEY` | — | Bearer key for the hosted API. Required for the hosted endpoint. |
| `CIRCUIT_URL` | `https://api.decisioncircuits.com/v1/systemone` | Any server speaking `POST /v1/systemone`. |
| `CIRCUIT_MODEL` | `circuit-vl-4b` | Model name sent in the request. |
| `CIRCUIT_MOCK` | `0` | `1` = no model call; fake, labelled numbers for UI work. |

All variables are read on the server only; the key never reaches the browser.

## 13. Adding new choices

Edit `src/config/decision.ts`:

```ts
{
  id: "gym_bro",                // sent to the model as the option name
  label: "Gym Bro",             // UI only
  emoji: "💪",
  description: "Mirror selfie in a gym, visible muscles, tank top, protein shaker.",  // sent to the model
}
```

and add jokes for it in `src/config/messages.ts`. That's all: the request,
validation, bars, Nerd Mode and Teaching Mode all read from the config.

Things to know:

- **The description is part of the question.** Describe what is *visible*.
- **Consider a fallback option** (`"other": "None of the above"`) if you want
  the model to be able to say no. Softmax cannot abstain on its own.
- The contract accepts up to 255 `choice` options; the pointer head has no
  fixed cap. Very long option lists make the input sequence longer.
- Only `choice`, `noul` and `score` questions work with image states.

## 14. Visual identity (and the meme)

### Where the categories come from

The four archetypes come from a meme titled **"The 4 types of IT guys"**:
a 2×2 grid of four images. We don't know who made it first; it gets passed
around as a screenshot. The grid has a cartoon nerd, a bearded
flannel-and-glasses tech guy, an anime femboy character and a photo of
someone in a fursuit. The demo keeps that joke and turns it into a bounded
decision. We changed the first two slots to `architect` and `apple_guy`.

**The meme is not in this repo, on purpose.** It combines copyrighted
cartoon and anime characters, fan art by someone we can't identify, and a
photo of a real person in their fursuit. We have no right to redistribute
any of it. Describe it in your talk, or show it from wherever you found it.

It also makes a good test input if you upload it yourself (it is not
shipped here):

- **Upload the whole grid.** All four archetypes are in one image, and a
  `choice` question must spread probability over options that all partly
  apply. See whether the distribution spreads out or the model is
  overconfident. The Limitations section says to expect overconfidence.
- **Crop each panel and upload them one at a time.** Each panel should fit
  one option much better than the others. The two top panels don't map
  cleanly onto `architect` and `apple_guy`, which is a live example of the
  mismatch between an image and its option descriptions.

### The look

The page is dressed as the meme with the art removed: a white page, the
heavy black caption "The 4 types of IT guys", and a 2×2 grid of empty panels
labelled with the four options. The whole grid is the upload target. After a
decision, your picture fills the winning panel with a classic meme caption,
and every panel shows its probability. No images ship with the app.

"Goofy ahh" is internet slang (on Twitter since at least 2009, popular on
TikTok from late 2021); see
[Know Your Meme: Goofy Ahh](https://knowyourmeme.com/memes/goofy-ahh). The
related **"Goofy Ahh Pictures"** format (fisheye, bizarre-perspective photos)
is where the name comes from, not the design; those images are
user-submitted and mostly of unknown origin, so none are bundled.

For **test images**, use your own photos or images you have permission to use.

## 15. References / further reading

Primary sources (the author's):

- **Model card:** [jbarney/circuit-vl-4b](https://huggingface.co/jbarney/circuit-vl-4b)
- **Server and training harness:** [Barneyjm/circuit](https://github.com/Barneyjm/circuit):
  [`s1proto/template.py`](https://github.com/Barneyjm/circuit/blob/main/s1proto/template.py) (pointer layout),
  [`s1proto/media.py`](https://github.com/Barneyjm/circuit/blob/main/s1proto/media.py) (`PointerHead`, image handling),
  [`s1proto/scorer.py`](https://github.com/Barneyjm/circuit/blob/main/s1proto/scorer.py),
  [`s1proto/schema.py`](https://github.com/Barneyjm/circuit/blob/main/s1proto/schema.py) (the contract),
  [`docs/cold-eval.md`](https://github.com/Barneyjm/circuit/blob/main/docs/cold-eval.md) (evaluations)
- **SDK:** [Barneyjm/decision-circuits](https://github.com/Barneyjm/decision-circuits),
  [`docs/concepts.md`](https://github.com/Barneyjm/decision-circuits/blob/main/docs/concepts.md),
  [`examples/12_images_and_audio.py`](https://github.com/Barneyjm/decision-circuits/blob/main/examples/12_images_and_audio.py)
- **Hosted API and keys:** [decisioncircuits.com](https://decisioncircuits.com)
- **Background article:** [Attaining LLM Certainty with AI Decision Circuits](https://towardsdatascience.com/attaining-llm-certainty-with-ai-decision-circuits/)

Background:

- [Qwen/Qwen3-VL-4B-Instruct](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct): the base model
- Hu et al., [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) (2021)
- Guo et al., [On Calibration of Modern Neural Networks](https://arxiv.org/abs/1706.04599) (2017): ECE and temperature scaling
- Kahneman, *Thinking, Fast and Slow* (2011): System 1 and System 2

This project is not affiliated with the model's author. Figures quoted here
are from the sources above as of September 2026 and may change as new
revisions are published.
