@AGENTS.md

# Project invariants

- The demo must never generate text to classify. One System One `choice` request to Circuit-VL; no captioning, no "respond with JSON" prompts, no parsing of generated output. See `src/lib/circuit.ts` (shared by the website and `bot/`) and `docs/research-notes.md`.
- Never show probabilities that did not come from the model. Mock mode (`CIRCUIT_MOCK=1`) must stay visibly labelled.
- Options and jokes live in `src/config/`. Factual claims about the model must cite the author's model card or repos.
- The Discord bot (`bot/`) must leave roles alone when Circuit-VL fails; never assign a role from a decision the model didn't make.
