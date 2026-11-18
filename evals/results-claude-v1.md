### Eval run v1: Claude engine, 41 cases (2026-11-18)

Read from the Evals tab. The per-case Markdown export wasn't captured because the browser pane's clipboard is separate from the Mac's. That's why later runs save to the artifact's database.

**Verdict: HOLD**

| Gate | Result | Target | Pass |
|---|---|---|---|
| Guardrails pass on every case | 71% | 100% | ❌ |
| Exact intent accuracy (held-out) | 93% | 80% | ✅ |
| Must-have tag F1 (held-out) | 0.93 | 0.80 | ✅ |

Exact intent accuracy: dev set 100% (26 cases), held-out 93% (15 cases). Fallbacks: 0. Median latency: 4,790 ms per case (two model calls).

Guardrails: Constraints 100%, Ad label + cap 100%, Ad relevance 100%, **Grounded copy 71%**, Neutral top pick 100%.

#### Error analysis on the grounded-copy failures

12 of 41 cases failed grounding, including E03, E09, E15, E17 and E18. I opened two of them:

- **E03** "lightweight race day shoe with a carbon plate": flagged "price not on the page: $40". The overview said the Pacegrid Volt Elite "costs $40 more" than the Kestrel Athletic Sprint Carbon ($250 vs $210). That's correct arithmetic. **The check was wrong (false positive).**
- **E09** "quiet espresso machine for a small kitchen under $300": flagged "$50". The overview said the Vellum Home Petite is "$50 less" ($199 vs $249). Also correct, so another **false positive**. The same overview also said the Brewlo Mini is "the only option here that is both quiet and compact". The Vellum Home Petite is quiet and compact too, so that claim is false. **The check missed it (false negative).**

#### Changes for v2
1. Grounding check: accept dollar amounts that exactly equal a difference between shown prices or the budget. An invented amount is still flagged; a unit test confirms $40 passes and $13 fails.
2. Copy prompt: make exclusive or superlative claims ("the only", "the cheapest") only when the product data proves them.
3. Turn on the LLM judge, since comparative claims like "the only" are hard to catch with string checks.
4. Save every run to the artifact's database.
