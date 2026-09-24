import GenerationRace from "./GenerationRace";

function Section({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h3 className="meme text-2xl sm:text-3xl">
        {n}. {title}
      </h3>
      <div className="doc mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Diagram({ children, caption }: { children: string; caption?: string }) {
  return (
    <figure className="my-6">
      <pre className="overflow-x-auto border-2 border-black bg-neutral-50 p-4 font-mono text-[13px] leading-snug">{children}</pre>
      {caption && <figcaption className="mt-1 text-sm text-neutral-500">{caption}</figcaption>}
    </figure>
  );
}

function Callout({ tone = "plain", children }: { tone?: "plain" | "yellow" | "red"; children: React.ReactNode }) {
  const tones = { plain: "border-black", yellow: "border-yellow-400 bg-yellow-50", red: "border-red-600 bg-red-50" };
  return <div className={`border-l-8 py-2 pr-3 pl-4 ${tones[tone]}`}>{children}</div>;
}

const USE_CASES = [
  { domain: "Goofy demo", state: "PFP", options: ["architect", "apple_guy", "femboy", "furry"] },
  { domain: "Document processing", state: "Document image", options: ["invoice", "contract", "purchase_order", "other"] },
  { domain: "Manufacturing", state: "Part photo", options: ["normal", "crack", "corrosion", "deformation"] },
  { domain: "Insurance", state: "Claim image", options: ["hail", "collision", "flood", "other"] },
  { domain: "Operations", state: "Dashboard screenshot", options: ["healthy", "degraded", "critical"] },
];

const REFS: [string, string, string][] = [
  ["jbarney/circuit-vl-4b (model card)", "https://huggingface.co/jbarney/circuit-vl-4b", "The model: base, LoRA, pointer head, training data, caveats."],
  ["Barneyjm/circuit", "https://github.com/Barneyjm/circuit", "Open-weights server and training harness. s1proto/template.py, scorer.py, media.py, docs/cold-eval.md."],
  ["Barneyjm/decision-circuits", "https://github.com/Barneyjm/decision-circuits", "The SDK: questions, gates, the SystemOne backend, Image states."],
  ["decisioncircuits.com", "https://decisioncircuits.com", "Hosted API and free keys."],
  ["Qwen/Qwen3-VL-4B-Instruct", "https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct", "The base vision-language model."],
  ["Attaining LLM Certainty with AI Decision Circuits", "https://towardsdatascience.com/attaining-llm-certainty-with-ai-decision-circuits/", "The article the decision-circuits idea comes from."],
  ["LoRA (Hu et al., 2021)", "https://arxiv.org/abs/2106.09685", "Low-rank adaptation."],
  ["On Calibration of Modern Neural Networks (Guo et al., 2017)", "https://arxiv.org/abs/1706.04599", "ECE and temperature scaling."],
];

export default function Education() {
  return (
    <div className="space-y-14">
      <header>
        <h2 className="meme text-4xl sm:text-5xl">Okay, but what actually happened?</h2>
        <p className="mt-4 max-w-3xl text-lg">
          You uploaded a picture and got four numbers back. The joke is the categories. The interesting part is that no text was generated anywhere. This section explains what that means, why
          it is different from asking an LLM nicely for JSON, and when you might care.
        </p>
        <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {[
            ["#llm", "1. Generative LLMs"],
            ["#circuit", "2. Circuit-VL"],
            ["#difference", "3. The key difference"],
            ["#internals", "4. Inside one request"],
            ["#why", "5. Why care"],
            ["#limitations", "6. Limitations"],
            ["#refs", "7. References"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="underline">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="llm" n="1" title="What is a conventional generative LLM?">
        <p>
          A language model reads text as <b>tokens</b>: chunks of a word, a word, a bit of punctuation, each an integer id from a vocabulary of roughly 100,000 to 250,000 entries. Given a
          sequence of tokens, the model outputs a probability for every token in that vocabulary being the <b>next</b> one. That is all it is trained to do: <b>next-token prediction</b>.
        </p>
        <p>
          To get a response, you <b>generate autoregressively</b>: run the prompt through the model (the <i>prefill</i>), pick a next token from that distribution (greedy or sampled), append it,
          and run the model again. One forward pass per output token, until an end token or a length limit. The answer is whatever sequence falls out.
        </p>
        <Diagram caption="Autoregressive generation: every output token is another trip through the model.">{`Prompt
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
generated response (free text)`}</Diagram>
        <p>
          A vision-language model (VLM) is the same thing with an image encoder in front: the image becomes a run of <i>image tokens</i> that sit in the sequence alongside the text.
        </p>
        <p>
          Applications usually need a <b>decision</b>, not prose: route this ticket, flag this part, pick a category. So developers ask for structure: <i>“Respond with JSON containing one of
          these four values.”</i> Many APIs add JSON mode or constrained decoding to make the output parse. You still end up with a pipeline that has to parse the text, check the value is one of
          the allowed ones, decide what to do when it isn’t, and, if you want a confidence, either ask the model to state one (which is not calibrated) or read token log-probabilities.
        </p>
        <Diagram caption="The common way to build a classifier out of a generative VLM.">{`Image
   │
   ▼
Generative VLM
   │   "Please return one of:
   │    architect | apple_guy | femboy | furry"
   ▼
Generated text      e.g.  {"archetype": "furry"}   or   "Sure! This looks like a furry."
   │
   ▼
Parse / validate    is it JSON? is the value allowed? retry if not
   │
   ▼
Application decision`}</Diagram>
        <Callout>
          <p>
            <b>This works.</b> Plenty of production systems do exactly this, and a big generative model is flexible in ways a small decision model is not. This demo is not arguing that generative
            models are bad. It is showing a different way to use a model when the task is a bounded decision.
          </p>
        </Callout>
      </Section>

      <Section id="circuit" n="2" title="What is Circuit-VL?">
        <p>
          <b>circuit-vl-4b</b> is the image member of the <b>Circuit</b> family of open-weights <b>System One</b> models by James Barney. The author defines a System One model as one that
          answers <i>typed questions about a state with calibrated probability distributions, in one forward pass, with no text generation</i>. The name comes from Daniel Kahneman’s{" "}
          <i>Thinking, Fast and Slow</i>: System 1 is the fast, intuitive judgment; System 2 is slow, deliberate reasoning. A chat model writing an essay about your picture is closer to System 2.
          The family: circuit-1.7b and circuit-8b (text), circuit-vl-4b (images), circuit-audio-7b (sound). They speak the same <code>POST /v1/systemone</code> contract as TypeSafe’s Jev.
        </p>
        <p>How circuit-vl-4b is built, from the model card and the open-source server:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <b>Base model:</b> Qwen/Qwen3-VL-4B-Instruct (Apache 2.0), a general vision-language model.
          </li>
          <li>
            <b>Frozen vision encoder:</b> the part that turns pixels into image tokens is not changed at all.
          </li>
          <li>
            <b>LoRA adapter:</b> a small low-rank update (rank 16, alpha 32) on the <i>language model’s</i> attention and MLP projections only, about 33M trainable parameters. The 4B base
            weights stay as they are.
          </li>
          <li>
            <b>Pointer readout head:</b> a tiny new layer, two projection matrices. This is what replaces text generation.
          </li>
          <li>
            <b>Training:</b> cross-entropy against outcome labels on a “vision grid” of rendered receipts, charts, tables, forms and shape scenes, and (in v2) real Open Images photos with
            human-verified labels. Labels are computed by code or by humans, never by another model. Because the loss is on the probability of the right option, calibration is learned rather
            than hoped for; a per-question-type temperature is fitted on validation data on top.
          </li>
        </ul>
        <p>
          <b>How a question is represented.</b> The server writes one sequence: the image, the question text, and then each option wrapped in delimiter tokens,{" "}
          <code>&lt;|box_start|&gt;architect — description&lt;|box_end|&gt;</code>, one per line, and at the very end a <b>decide token</b>, <code>&lt;|fim_middle|&gt;</code>. These are Qwen
          reserved tokens that never appear in normal text (user text is sanitized so it can’t forge them).
        </p>
        <p>
          <b>How it answers.</b> One forward pass over that whole sequence. Because the model attends across everything, the hidden state at each option’s closing{" "}
          <code>&lt;|box_end|&gt;</code> has “read” the image, the question and that option; the hidden state at the decide token has read all of it. The pointer head makes a{" "}
          <b>query</b> from the decide token and a <b>key</b> from each option’s closing delimiter, and scores each option by a scaled dot product:
        </p>
        <Diagram>{`q      = W_q · h(<decide>)
k_i    = W_k · h(</opt_i>)          one per option
logit_i = (k_i · q) / √d             d = 256
p      = softmax(logit / T)          T = calibrated temperature`}</Diagram>
        <p>
          The output is exactly one number per option you supplied. There is no vocabulary to sample from, so there is nothing to parse and no way to produce an option you didn’t list. There is
          also no option cap and no letter labels (A/B/C), so the list can be long.
        </p>
        <Diagram caption="Simplified conceptual diagram. Real inputs are one token sequence; the head reads specific positions in it.">{`                 IMAGE
                   │
                   ▼
          ┌─────────────────┐
          │ Vision Encoder  │   frozen (Qwen3-VL)
          └────────┬────────┘
                   │  image tokens  + question + <opt>architect</opt> … <decide>
                   ▼
          ┌─────────────────┐
          │ Language Model  │   Qwen3-VL-4B LM
          │ + LoRA Adapter  │   rank 16, ~33M trained params
          └────────┬────────┘
                   │  hidden states at each </opt> and at <decide>
                   ▼
          ┌─────────────────┐
          │ Pointer Readout │   score = key(option) · query(decide)
          └────────┬────────┘
                   │  softmax
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼
    architect  apple_guy   femboy     furry
      0.xx       0.xx       0.xx       0.xx`}</Diagram>
      </Section>

      <Section id="difference" n="3" title="The key difference">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="border-2 border-black p-4">
            <p className="font-bold">Generative VLM</p>
            <pre className="mt-2 font-mono text-sm leading-7">{`IMAGE
  ↓
MODEL
  ↓
GENERATE TOKENS
  ↓
TEXT ANSWER
  ↓
PARSE ANSWER
  ↓
DECISION`}</pre>
          </div>
          <div className="border-2 border-black bg-yellow-50 p-4">
            <p className="font-bold">Circuit-VL</p>
            <pre className="mt-2 font-mono text-sm leading-7">{`IMAGE + QUESTION + OPTIONS
  ↓
MODEL
  ↓
SCORE BOUNDED OPTIONS
  ↓
PROBABILITY DISTRIBUTION
  ↓
DECISION`}</pre>
          </div>
        </div>
        <p className="meme py-4 text-center text-4xl sm:text-5xl">
          <span>Generation</span> vs. <span>Decision</span>
        </p>
        <GenerationRace />
        <div className="overflow-x-auto">
          <table className="mt-4 w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b-2 border-black text-sm">
              <tr>
                <th className="py-2 pr-4" />
                <th className="py-2 pr-4">Generative VLM + “return JSON”</th>
                <th className="py-2">Circuit-VL</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:border-neutral-300 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top">
              <tr>
                <td className="font-bold">Output</td>
                <td>Any sequence of tokens</td>
                <td>One probability per supplied option</td>
              </tr>
              <tr>
                <td className="font-bold">Where options live</td>
                <td>In the prompt, as a request</td>
                <td>In the input, as the only things the head can score</td>
              </tr>
              <tr>
                <td className="font-bold">Invalid answers</td>
                <td>Possible; you parse, validate, retry</td>
                <td>Not representable</td>
              </tr>
              <tr>
                <td className="font-bold">Confidence</td>
                <td>Stated (uncalibrated) or read from token log-probs</td>
                <td>The softmax itself, trained for calibration</td>
              </tr>
              <tr>
                <td className="font-bold">Forward passes</td>
                <td>1 prefill + 1 per output token</td>
                <td>1 (output_tokens: 0)</td>
              </tr>
              <tr>
                <td className="font-bold">Can explain itself in words</td>
                <td>Yes (whether the explanation is faithful is another matter)</td>
                <td>No. You can measure what moves it, not ask it</td>
              </tr>
              <tr>
                <td className="font-bold">Open-ended questions</td>
                <td>Yes</td>
                <td>No: you must know the options up front</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="yellow">
          <p>
            <b>A fair footnote.</b> You can also get a distribution out of a generative model without generating: letter the options A–D and read the next-token probabilities of “A”…“D”. The
            Circuit author’s own baseline does exactly that with the raw Qwen3-VL-4B (“letter logits”). On the author’s vision grid v2 that baseline scores 92.6% / ECE 0.079, against 96.4% / ECE
            0.036 for circuit-vl-4b. The pointer head removes the letter labels, the 26-option cap and the position cues that letters introduce, and it is trained for this job.
          </p>
        </Callout>
      </Section>

      <Section id="internals" n="4" title="Show what happens internally">
        <p>
          Turn on <b>Nerd Mode</b> above and upload a picture. For one real request you will see:
        </p>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            <b>The state</b>: <code>{"{ image: <data URI> }"}</code>. The image is sent as pixels; there is no caption and no intermediate description.
          </li>
          <li>
            <b>The question and the choices</b>: a <code>choice</code> question with our four option names and their descriptions as <code>criteria</code>. These four words come from{" "}
            <code>src/config/decision.ts</code>. The model did not write them.
          </li>
          <li>
            <b>The sequence</b>: reconstructed from the server’s template, with the positions the head reads highlighted (each <code>&lt;|box_end|&gt;</code> and the final{" "}
            <code>&lt;|fim_middle|&gt;</code>).
          </li>
          <li>
            <b>The scoring</b>: option → score → probability. The API returns probabilities; the score column is log p, which is each temperature-scaled logit minus a constant shared by all
            options.
          </li>
          <li>
            <b>The bookkeeping</b>: selected choice, confidence, round-trip latency, the model and revision the server reports, and the untouched raw response. Note <code>output_tokens: 0</code>.
          </li>
          <li>
            <b>An order check</b>: re-ask with the options reversed, and see how much the numbers move.
          </li>
        </ol>
        <p>
          And turn on <b>Teaching Mode</b> for the same story one stage at a time, with arrow-key navigation, for a projector.
        </p>
      </Section>

      <Section id="why" n="5" title="Why would anyone care?">
        <p>Swap the joke for a real label set and the architecture is the same:</p>
        <div className="grid">
          {USE_CASES.map((u) => (
            <div key={u.domain} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-neutral-300 py-2">
              <span className="w-48 font-bold">{u.domain}</span>
              <span className="text-neutral-600">{u.state} →</span>
              <span className="flex flex-wrap gap-2 font-mono">
                {u.options.map((o) => (
                  <code key={o} className="text-sm">
                    {o}
                  </code>
                ))}
              </span>
            </div>
          ))}
        </div>
        <Callout>
          <p className="text-lg">
            If the task is fundamentally a <b>bounded decision</b>, do we always want a generative model producing arbitrary tokens?
          </p>
        </Callout>
        <p>What a bounded decision model buys you, where it fits:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <b>The output contract is the model’s shape.</b> No parser, no “the model said <i>Furry.</i> with a full stop” bug, no retry loop for invalid JSON.
          </li>
          <li>
            <b>A distribution, not a verdict.</b> You can threshold it, route near-ties to a person, and write that policy in code you can test offline. That is what the author’s{" "}
            <i>decision-circuits</i> SDK is for: gates like “act if P ≥ 0.7, escalate inside a band around the threshold”.
          </li>
          <li>
            <b>Predictable cost and latency.</b> One prefill, no decoding loop. The author measured about 90 ms per item for circuit-vl-4b on an A6000; the hosted API scales to zero, so the
            first call after a quiet spell waits about a minute for a GPU.
          </li>
          <li>
            <b>A small, open model you can run and audit.</b> Apache-2.0 base, published adapter and head, a harness that reproduces the evaluations.
          </li>
        </ul>
        <p>And what it costs you:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <b>You must know the options in advance.</b> Open-ended extraction, summaries and explanations are still generative work.
          </li>
          <li>
            <b>Softmax always sums to one.</b> If “none of these” is possible, it has to be an option. This demo has no such option on purpose: upload a sandwich and it will still be one of four.
          </li>
          <li>
            <b>A 4B model trained on a small, specific dataset</b> is not a frontier model. On tasks far from its training data a large general model may simply be more accurate.
          </li>
          <li>
            <b>No reasoning trace.</b> You can probe it (change the input, re-ask, compare) but you cannot ask it why.
          </li>
          <li>
            <b>Research-stage tooling.</b> The SDK is 0.x/alpha and the model family is weeks old.
          </li>
        </ul>
        <p>
          The consulting-grade answer is the usual one: it depends, so measure. Take a few hundred labelled examples from the real task, run both approaches, and compare accuracy, calibration,
          latency and cost.
        </p>
      </Section>

      <Section id="limitations" n="6" title="Limitations (read this one)">
        <Callout tone="red">
          <p>
            <b>This is a joke classifier on an experimental research model.</b> It classifies the visual presentation of an image into four made-up internet archetypes. It says nothing about who
            a person is, and it should not be used to say anything about anyone.
          </p>
        </Callout>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <b>Way off distribution.</b> circuit-vl-4b was trained on rendered receipts, charts, tables, forms and shape scenes plus a set of Open Images photos. Internet archetypes are not in
            there. Calibration is measured on the distribution it was trained for; here the probabilities are just the model’s scores, not a promise that “76%” means right 76% of the time.
          </li>
          <li>
            <b>Overconfidence on ambiguous inputs is documented.</b> The model card reports that on items rendered to be undecidable (a blurred field under a comparison question) the model
            answers with mean confidence 0.93 where it should be near 0.5, and calls calibration on ambiguity “the open problem”. The v2 evaluation still shows 0.88 mean confidence on ambiguous
            items.
          </li>
          <li>
            <b>Real photos are harder than rendered images.</b> On the author’s v2 grid: 96.4% / ECE 0.036 overall, but 89.5% / ECE 0.105 on the real-photo cells. On POPE (object presence in COCO
            photos) 92.3% / ECE 0.049, about the same as the untuned base.
          </li>
          <li>
            <b>Small training set, held-out items not held-out structure.</b> About a thousand training items (1,083 in v1; 1,408 in v2). The model card says the grid evaluation holds out
            items, not task structures.
          </li>
          <li>
            <b>Option order matters a little.</b> Options sit in the input sequence. The author measured 3.6% of top answers changing under reordering for circuit-vl-4b v1.1 (concentrated in
            classification and deliberately ambiguous items), and an options-side-by-side variant that brings this to 0% in their tests. Nerd Mode lets you check it on your image.
          </li>
          <li>
            <b>Probability is not correctness.</b> A bounded output can be confidently wrong. A distribution helps you decide when not to trust an answer; it does not make an answer true.
          </li>
          <li>
            <b>The descriptions are part of the question.</b> The author’s rubric probe found Circuit models follow the option descriptions. Change the wording in{" "}
            <code>src/config/decision.ts</code> and the numbers will change.
          </li>
          <li>
            <b>Not a benchmark.</b> Nothing here shows that Circuit is better than any other approach for any classification problem, including this one.
          </li>
        </ul>
      </Section>

      <Section id="refs" n="7" title="References and further reading">
        <ul className="space-y-3">
          {REFS.map(([title, href, note]) => (
            <li key={href}>
              <a href={href} className="font-bold underline" target="_blank" rel="noreferrer">
                {title}
              </a>
              <span className="text-neutral-600"> · {note}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-neutral-500">
          Figures on this page come from the circuit-vl-4b model card and from <code>docs/cold-eval.md</code> in the circuit repository (September 2026). The README in this project’s repository
          goes deeper.
        </p>
      </Section>
    </div>
  );
}
