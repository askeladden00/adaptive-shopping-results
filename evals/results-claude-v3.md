### Eval run v3: Claude engine, 41 cases (2026-11-18)

Changes from v2: runtime guardrail (ungrounded LLM copy is replaced by template copy before the shopper sees it); new gate on the raw LLM copy grounding rate; the judge now sees the hero product.

**Verdict: HOLD**

| Gate | Result | Target | Pass |
|---|---|---|---|
| Guardrails pass on every case | 100% | 100% | ✅ |
| Exact intent accuracy (held-out) | 93% | 80% | ✅ |
| Must-have tag F1 (held-out) | 0.93 | 0.80 | ✅ |
| Raw LLM copy grounded (before fallback) | 92% | 95% | ❌ |
| LLM judge helpfulness (1-5) | 4.11 | 4.00 | ✅ |

Exact intent accuracy: dev set 100% (26 cases), held-out 93% (15 cases). Median latency: 4,844 ms per case.

Raw LLM copy failed the grounding check on 3 of 37 pages (E07, E10, H15). Those pages showed template copy instead. Guardrails on the page the shopper sees: 100% on all five.

The judge fix worked. The product-focus pages E06, E12 and H10 went from 2, 2, 1 to 5, 4, 4.

#### Error analysis
- **All 3 raw grounding failures had one cause:** the copy discussed sponsorship ("the best-rated non-sponsored quiet option", "if you want the best-rated option without sponsorship", "lightest of the cushioned non-sponsored options"). **Root cause was in the prompt design:** the copy model saw a `sponsored` flag on each product and was told to pick from non-sponsored items, so the concept leaked into the copy.
- **The judge rubric conflicted with the ad policy:** on E15, H15 and E10 the judge docked points for "not disclosing sponsorship". By policy, the page labels ads and the copy must not discuss them.
- **Template fallback copy overclaims:** "ranks first on fit and rating" is wrong when ranking also uses inferred nice-to-haves (E10, H15; judge 2). This matters because the template is now the fallback the shopper sees.
- **H11:** the same spec ambiguity as in v2 (gift → explore vs stated need → compare). Left untuned.

#### Changes for v4
1. The copy model no longer sees which products are sponsored. It gets a `top_pick_eligible` field instead. The judge still sees the sponsored flag, to check for favoritism.
2. Judge rubric: don't penalize copy for not disclosing sponsorship, since the page labels ads.
3. Template wording: "ranks first for your stated needs".
