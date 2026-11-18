### Eval attempt 1: Gemini engine (gemini-3.5-flash), stopped after 2 of 41 cases (2026-11-18)

**Not a usable result.** Google's capacity, not the prototype, stopped the run:
- E01: Gemini answered the intent correctly, but the summary call hit the 60-second limit, so the page used template copy.
- E02: Gemini returned HTTP 503 ("high demand") three times, so the rules baseline answered the intent.
- Case 3: HTTP 429 (rate limit) stopped the run. The key appears to be on the free tier, which allows only a few requests per minute.

Earlier timing checks the same day: gemini-3.8-flash and gemini-3.7-flash returned 503; gemini-3.5-flash answered a tiny request in 1.6 s.

#### What this attempt exposed in the eval harness (fixed)
1. When the model failed and the rules baseline answered, the case was scored as if the engine had answered (E02 showed ✅). Now a fallback counts as an engine miss.
2. "Raw LLM copy grounded 100%" counted pages where the model never wrote a summary. Now only summaries the model actually wrote count, and zero written summaries fails the gate.
3. A run that stops early could still pass the other gates. There's now an "All 41 cases ran" gate.

The Claude v4 run had no fallbacks and finished all 41 cases, so its result is unchanged under the corrected scoring.

#### Original export (scored before the fixes)

| Gate | Result | Target | Pass |
|---|---|---|---|
| Guardrails pass on every case | 100% | 100% | ✅ |
| Exact intent accuracy (held-out) | – | 80% | ❌ |
| Must-have tag F1 (held-out) | – | 0.80 | ❌ |
| Raw LLM copy grounded (before fallback) | 100% | 95% | ✅ (wrong: no summaries were written) |

| Case | Query | Intent exact | Must F1 | Guardrails | Notes |
|---|---|---|---|---|---|
| E01 | running shoes for flat feet under $120 | ✅ | 1.00 | ✅ | copy: Gemini didn't answer within 60 seconds; used template |
| E02 | my knees ache after long runs, I need more cushion | ✅ (wrong: baseline answered) | 1.00 | ✅ | intent: HTTP 503 ×3; used rules baseline; copy skipped |

Median latency per case: 64.7 s.
