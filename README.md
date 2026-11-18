# Adaptive Shopping Results

An AI shopping search prototype. A shopper describes what they need in their own words. An LLM works out the intent, and the results page changes shape to fit it: a comparison table, a guided browse, or a product focus. Sponsored and organic results are blended and labeled, and an intent-aware ad auction prices relevance as well as bids.

**Live demo:** [claude.ai artifact](https://claude.ai/artifact/1Co4jhFhPcwG2AGrXQkYSh). It's private until shared from the artifact page. It runs with Claude, with no API key.
**Run locally:** `python3 -m http.server 8000`, then open http://localhost:8000. Locally you can use the rules baseline, or Gemini with your own API key.

Built in a few evenings with Claude Code as an AI-native prototype. All product, brand and campaign data is fictional and was written for this project.

---

## The user problem

Shoppers often know their situation, not the product spec. "I get up at 5am and don't want my coffee machine to wake the kids" means *quiet espresso machine*. "My arches collapse" means *stability shoe*. Keyword retrieval misses those needs, so shoppers rewrite the query, scan grids of near-misses, and open many tabs to compare.

A list of ten links is also the wrong page for many intents:

| Shopper intent | What helps | Layout here |
|---|---|---|
| States needs or a budget ("quiet, small kitchen, under $300") | Side-by-side on the things they said matter | **Comparison** table with ✓/– on each stated need |
| Broad ("headphones", "gift ideas for a coffee lover") | Ways into the category | **Guided browse** grouped by the attributes that split the category |
| Names a product ("Brewlo Mini") | That product first, then close alternatives | **Product focus** + "Compare similar" |
| Nothing matches ("running shoes under $40") | Honesty, then a choice of what to loosen | **No exact matches** with relax buttons (never relaxed silently) |

Each page also has an AI overview grounded in the products shown, refinement chips that split the remaining results, and a follow-up box ("make it under $150 and lighter") that carries the conversation forward.

## The advertiser value

- **Relevance is part of the price.** Ad rank = max CPC bid × relevance to the shopper's parsed intent, and winners pay a second price. On "running shoes for flat feet under $120", a $2.40 bid on a carbon racer has relevance 0.14 and never shows. Stability shoes compete instead.
- **Intent-level targeting.** Advertisers reach shoppers who never typed a keyword they bid on. Once the LLM maps "doesn't sound like a jet engine" to the *quiet* tag, a quiet machine's ad can compete for that query.
- **No paying for a spot already earned.** A product already in the top organic positions can't also win an ad slot, so the advertiser doesn't pay for traffic it was getting anyway. Organic ranking is computed before the auction and is never changed by it.
- **Ad load fits the layout:** 2 slots on comparison and browse pages, 1 on product focus, 0 when the query is out of scope or nothing matches.
- **Transparent:** the *Advertiser view* panel shows every campaign's bid, relevance, ad rank, outcome and the reason it won or lost.

Healthier ads (relevant, clearly labeled, capped) protect shopper trust. That trust is what lets an ads business grow inside AI answers.

## How it works

```
shopper words ──► [LLM] intent ──► [code] schema guard ──► [code] retrieve + rank ──► [code] ad auction
                                                                                         │
       guardrail checks ◄── [LLM] grounded overview ◄── [code] choose layout ◄───────────┘
```

The LLM does only the two jobs rules do badly:
1. **Intent understanding:** maps free text onto a controlled schema (category, budget, must-have, nice-to-have and excluded attribute tags, funnel stage, product reference).
2. **Overview copy:** a 2-3 sentence summary, a top pick, and a "why it fits" note per product, grounded in the product data on the page.

Everything with money or trust attached is deterministic code: retrieval, ranking, the auction, ad labels and caps, and layout choice. A **schema guard** sits between the LLM and that code. It drops tags outside the vocabulary and products or brands that don't exist, so a model mistake can't invent a filter. If an LLM call fails, the page falls back to the rules baseline and says so.

Engines (switch in the header): **Claude** (claude.ai artifact runtime), **Gemini** (your API key, local only; the code path is written but I haven't tested it), and the **Rules baseline** (keyword parser and templates, the comparison point for evals).

## How it was evaluated

The eval design follows my [AI Evals framework](https://github.com/askeladden00/AI-Evals): strategy, then failure discovery, then the eval suite, then release gates, then a ship-or-hold decision. Everything runs in the app's **Evals** tab. Each run is saved to the artifact's database and exports to Markdown.

### 1. Strategy: what does "good" mean, and what does a mistake cost?
| Quality | Why it matters | Cost of getting it wrong |
|---|---|---|
| Intent understood | Drives the whole page | Wrong layout, filtered-out good products, a reformulated search |
| Constraints respected | Shoppers state hard limits | A $160 shoe on an "under $120" query breaks trust |
| Ads labeled, capped, relevant | Policy and trust | Regulatory and brand risk; ad blindness |
| Copy grounded | AI summaries are believed | A made-up feature or price is a false product claim |
| Top pick neutral | Organic must stay organic | AI recommendations that favor ads lose shoppers' trust |

### 2. Failure discovery: taxonomy from reviewing outputs
| # | Failure mode | Example (observed) | Severity |
|---|---|---|---|
| F1 | Implicit need missed | "doesn't sound like a jet engine" → no *quiet* tag | High: wrong page shape |
| F2 | Keyword collision | "half marathon t**rain**ing" → *waterproof* | High: filters out the right products |
| F3 | Category miss on unseen wording | "trail **runners**", "**cappuccinos**" → out of scope | High: a dead end for an in-scope shopper |
| F4 | Exclusion read as preference | "not the Quietform ones" → only Quietform shown | Critical: the opposite of intent |
| F5 | Instruction text taken as a preference | injection query → brand filter set to Pacegrid | Medium: contained by the guardrails below |
| F6 | Inferred need made mandatory | "transatlantic flight" → *noise-cancelling* required | Medium: over-filtering |
| F7 | LLM copy risks | invented price ($300 on a no-budget query); false exclusivity ("the only quiet and compact option"); "non-sponsored" wording | Critical → guardrail checks + runtime fallback |
| F8 | Evaluator errors | grounding check flagged correct arithmetic; judge never saw the hero product; judge rubric contradicted ad policy | High: wrong ship decisions |

F1–F6 were observed in the rules baseline; Claude fixed all of them on the eval set. F7 and F8 were found in the Claude runs, and section 5 shows how each was fixed.

### 3. Eval suite: three kinds of checks
- **Reference-based (intent):** 41 hand-labeled queries with gold intents. Scores are exact intent match (category, budget, stage, must-haves, plus product, exclusions and brand where labeled) and must-have tag F1.
  - **Dev set (26 cases)** covers common needs plus edge cases: out of scope, prompt injection, no results, multi-turn.
  - **Held-out set (15 cases)** was written *after* the baseline's keyword lists and the LLM prompt were frozen. It uses shopper phrasing ("my arches collapse"), not catalog phrasing. **Intent gates are measured on the held-out set.**
- **Code-based guardrails** run on every page, live in the UI and in the evals:
  constraints respected · ads labeled and within cap · ads above the relevance floor · copy grounded (every product, price, brand and attribute mentioned is on the page, and sponsorship isn't discussed) · top pick is organic.
- **LLM-as-judge:** rates overview helpfulness from 1 to 5. It sees which items are sponsored, so it can check for favoritism. Caveat: the same model family writes and judges, so treat this score as directional only.
- **Runtime enforcement:** the grounding check also runs in production. If an LLM overview fails it, the shopper sees template copy instead, and the eval reports how often the raw copy failed.

### 4. Release gates
| Gate | Target |
|---|---|
| Every guardrail passes on every case | 100% |
| Exact intent accuracy, held-out | ≥ 80% |
| Must-have tag F1, held-out | ≥ 0.80 |
| Raw LLM copy grounded, before fallback | ≥ 95% |
| Judge helpfulness (if run) | ≥ 4.0 |

### 5. Results
| Metric | Rules baseline | Claude v1 | Claude v4 (final) |
|---|---|---|---|
| Exact intent, **held-out** (15) | **33%** | 93% | **93%** |
| Must-have F1, held-out | 0.47 | 0.93 | 0.93 |
| Exact intent, dev set (26) | 81% | 100% | 100% |
| Guardrails, every case (page the shopper sees) | 100% | 71% | **100%** |
| Raw LLM copy grounded (before fallback) | n/a | 71% | **100%** (0 of 37 failed) |
| Judge helpfulness (1–5) | n/a | not run | 4.68 |
| Median latency per query | ~0 ms | 4.8 s | 4.7 s |
| Verdict | **HOLD** | **HOLD** | **SHIP** |

**What the numbers show:**
- **Keyword rules don't generalize.** They score 81% on queries like the ones they were written against and 33% on new phrasing. The LLM scores 93% on held-out, from understanding phrasing like "my arches collapse" and "doesn't sound like a jet engine". That gap is the case for an LLM in query understanding.
- **Prompt injection had no effect** on ranking, ads or labels (E24), because the LLM never touches them.
- **The remaining intent miss (H11)** is a spec ambiguity: "what should I get my sister who just started running?" is both a gift (→ browse) and a stated need (→ compare). It's left untuned on purpose, to keep the held-out set clean.

**How v1 got to v4.** Each run: read the failures, find the root cause, then fix the product or the evaluator.

| Run | Finding from error analysis | Fix |
|---|---|---|
| v1 → v2 | 12 grounding failures. The two I inspected were **false positives** in my check ("costs $40 more" is correct arithmetic). One overview also made a **false claim the check missed** ("the only option that is both quiet and compact") | Check accepts exact price differences; prompt allows "only/cheapest" claims only when the data proves them; LLM judge added |
| v2 → v3 | One real ungrounded price ($300). Judge scored the product-focus pages 1-2 because **the judge prompt never saw the hero product** (evaluator bug) | **Runtime guardrail:** ungrounded copy is replaced by template copy before the shopper sees it, plus a new gate on the raw grounding rate so the fallback can't hide quality; judge gets the hero product |
| v3 → v4 | 3 raw failures, all "non-sponsored" wording. **Root cause was in my prompt design:** the copy model saw sponsored flags. The judge rubric also penalized not disclosing ads, which conflicts with policy | Copy model no longer sees sponsored flags (gets `top_pick_eligible`); judge rubric aligned with ad policy |

Per-run detail: [baseline](evals/results-rules-baseline.md) · [v1](evals/results-claude-v1.md) · [v2](evals/results-claude-v2.md) · [v3](evals/results-claude-v3.md) · [v4](evals/results-claude-v4.md). Every run is also saved in the artifact's database.

**Caveats:** one run per version on 41 cases. The v2–v4 copy fixes are general (arithmetic, sponsorship wording) but were checked on the same cases, so a fresh held-out set comes next. The judge is from the same model family as the generator.

### 6. Ship or hold
**SHIP the v4 configuration as a prototype**, with the runtime grounding guardrail always on and the raw grounding rate monitored as a release metric. The rules baseline stays a **HOLD**: it fails both intent gates. Any guardrail failure on the page the shopper sees is an automatic HOLD, whatever the accuracy.

## What I'd do next
- A fresh held-out set (the current one has informed four iterations of copy fixes), built from real query logs, labeled by two people, with agreement measured.
- Resolve the gift-plus-stated-need ambiguity (H11) in the intent spec, then test the fix on that new set.
- Repeat each run 3–5 times to measure run-to-run variance before trusting a gate at its threshold.
- A judge from a different model family, calibrated against human ratings.
- Online metrics for an A/B test: query reformulation rate, time to first product click, add-to-cart rate; for ads, CTR, CPC and conversion rate on sponsored slots, plus a shopper-trust survey on the ad label.
- Learned relevance (embeddings over product content) instead of tag coverage.

## Files
```
index.html          page and styles
src/catalog.js      48 fictional products, attribute vocabulary, 16 fictional campaigns
src/engine.js       schema guard, rules baseline, retrieval, auction, layouts, guardrail checks
src/llm.js          Claude and Gemini adapters, prompts, pipeline with fallback
src/evals.js        41-case eval set, scoring, release gate, Markdown export
src/app.js          UI
evals/              saved eval runs
```
