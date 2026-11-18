### Eval attempt 2: Gemini engine (gemini-3.5-flash, paced), stopped after 2 of 41 cases (2026-11-18)

**Not a usable result.** This was the first run with pacing and the corrected scoring. It stopped on the free-tier **daily** quota, which waiting can't fix:
- E01: no answer within 60 seconds, so the rules baseline answered the intent and the template wrote the copy.
- E02: HTTP 503 ("overloaded") three times, so the same fallback.
- Case 3: HTTP 429 with a per-day quota. The run stopped as designed.

The corrected scoring behaved as intended. Both fallbacks count as Gemini misses (0% intent), the grounding gate fails because Gemini wrote no summaries, and the "All 41 cases ran" gate fails at 5%. Verdict: HOLD.

The day's earlier attempts, timing checks and live searches probably used most of the daily quota, including calls that timed out or returned 503. A full run needs about 82 calls (intent plus copy for each case), which may be more than one day's free-tier quota for this model.

#### Export

| Gate | Result | Target | Pass |
|---|---|---|---|
| All 41 cases ran | 5% | 100% | ❌ |
| Guardrails pass on every case | 100% | 100% | ✅ |
| Exact intent accuracy (held-out) | – | 80% | ❌ |
| Must-have tag F1 (held-out) | – | 0.80 | ❌ |
| Raw LLM copy grounded (before fallback) | – | 95% | ❌ |

| Case | Query | Intent exact | Must F1 | Guardrails | Notes |
|---|---|---|---|---|---|
| E01 | running shoes for flat feet under $120 | ❌ | 0.00 | ✅ | intent: no answer within 60 s; rules baseline used; copy skipped, template used |
| E02 | my knees ache after long runs, I need more cushion | ❌ | 0.00 | ✅ | intent: HTTP 503 ×3; rules baseline used; copy skipped, template used |

Median latency per case: 60.0 s.
