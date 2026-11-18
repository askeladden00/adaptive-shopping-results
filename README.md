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

The eval design follows my [AI Evals framework](https://github.com/askeladden00/AI-Evals): strategy, then failure discovery, then the eval suite, then release gates, then a ship-or-hold decision. Everything runs in the app's **Evals** tab and exports to Markdown.

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
| F7 | LLM copy risks | invented price or attribute; sponsored top pick; mentions sponsorship | Critical → guardrail checks |

F1–F6 were observed in the rules baseline. F7 lists the risks the LLM adds, and each one has a dedicated check.

### 3. Eval suite: three kinds of checks
- **Reference-based (intent):** 41 hand-labeled queries with gold intents. Scores are exact intent match (category, budget, stage, must-haves, plus product, exclusions and brand where labeled) and must-have tag F1.
  - **Dev set (26 cases)** covers common needs plus edge cases: out of scope, prompt injection, no results, multi-turn.
  - **Held-out set (15 cases)** was written *after* the baseline's keyword lists and the LLM prompt were frozen. It uses shopper phrasing ("my arches collapse"), not catalog phrasing. **Intent gates are measured on the held-out set.**
- **Code-based guardrails** run on every page, live in the UI and in the evals:
  constraints respected · ads labeled and within cap · ads above the relevance floor · copy grounded (every product, price, brand and attribute mentioned is on the page, and sponsorship isn't discussed) · top pick is organic.
- **LLM-as-judge (optional):** rates overview helpfulness from 1 to 5. Caveat: the same model writes and judges, so treat this score as directional only.

### 4. Release gates
| Gate | Target |
|---|---|
| Every guardrail passes on every case | 100% |
| Exact intent accuracy, held-out | ≥ 80% |
| Must-have tag F1, held-out | ≥ 0.80 |
| Judge helpfulness (if run) | ≥ 4.0 |

### 5. Results
| Metric | Rules baseline | Claude |
|---|---|---|
| Exact intent, **held-out** | **33%** | _pending_ |
| Must-have F1, held-out | 0.47 | _pending_ |
| Exact intent, dev set | 81% | _pending_ |
| Guardrails, all cases | 100% | _pending_ |
| Verdict | **HOLD** | _pending_ |

Full per-case output: [`evals/results-rules-baseline.md`](evals/results-rules-baseline.md). To add the Claude column, open the artifact, choose **Claude**, go to **Evals**, select **Run evals**, then **Copy results as Markdown** and save to `evals/results-claude.md`.

**What the baseline numbers show:** keyword rules reach 81% on queries similar to the ones they were written against, and 33% on new phrasing. That gap is the case for an LLM in the query-understanding step. Guardrails pass 100% for the baseline because its copy comes from templates. The guardrails exist to keep that bar when an LLM writes the copy.

### 6. Ship or hold
The rules baseline is a **HOLD**: it fails both intent gates. The ship decision for the LLM version depends on the Claude column above. Any guardrail failure is an automatic HOLD, whatever the accuracy.

## What I'd do next
- Bigger held-out set from real query logs, labeled by two people, with agreement measured.
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
