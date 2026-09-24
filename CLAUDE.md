@AGENTS.md

# Project invariants

- The demo must never generate text to classify. One System One `choice` request to Circuit-VL; no captioning, no "respond with JSON" prompts, no parsing of generated output. See `src/lib/systemone.ts` and `docs/research-notes.md`.
- Never show probabilities that did not come from the model. Mock mode (`CIRCUIT_MOCK=1`) must stay visibly labelled.
- Options and jokes live in `src/config/`. Factual claims about the model must cite the author's model card or repos.
