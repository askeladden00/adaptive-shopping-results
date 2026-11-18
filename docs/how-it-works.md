# How it works

```
shopper words ──► [LLM] intent ──► [code] schema guard ──► [code] retrieve + rank ──► [code] ad auction
                                                                                         │
       guardrail checks ◄── [LLM] grounded overview ◄── [code] choose layout ◄───────────┘
```

The LLM does only the two jobs rules do badly:
1. **Intent understanding:** maps free text onto a controlled schema (category, budget, must-have, nice-to-have and excluded attribute tags, funnel stage, product reference).
2. **Overview copy:** a 2-3 sentence summary, a top pick, and a "why it fits" note per product, grounded in the product data on the page.

Everything with money or trust attached is deterministic code: retrieval, ranking, the auction, ad labels and caps, and layout choice. A **schema guard** sits between the LLM and that code. It drops tags outside the vocabulary and products or brands that don't exist, so a model mistake can't invent a filter. If an LLM call fails, the page falls back to the rules baseline and says so.

## Engines

Switch engines in the app header:
- **Claude:** uses the claude.ai artifact runtime, so it needs no API key. Works only in the [claude.ai artifact](https://claude.ai/artifact/1Co4jhFhPcwG2AGrXQkYSh).
- **Gemini:** uses your own Google AI Studio API key, kept in your browser's local storage. Works when the page runs locally or on GitHub Pages, not on claude.ai. It answers live searches, but no full eval run has finished yet because of free-tier limits; eval runs on Gemini are paced to about 8 calls a minute and wait out per-minute rate limits.
- **Rules baseline:** a keyword parser and templates, with no LLM. It's the comparison point for evals.

Code map and run instructions: [prototype/README.md](../prototype/README.md).

---
[← Back to the project overview](../README.md)
