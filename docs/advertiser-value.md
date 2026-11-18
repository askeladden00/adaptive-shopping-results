# The advertiser value

- **Relevance is part of the price.** Ad rank = max CPC bid × relevance to the shopper's parsed intent, and winners pay a second price. On "running shoes for flat feet under $120", a $2.40 bid on a carbon racer has relevance 0.14 and never shows. Stability shoes compete instead.
- **Intent-level targeting.** Advertisers reach shoppers who never typed a keyword they bid on. Once the LLM maps "doesn't sound like a jet engine" to the *quiet* tag, a quiet machine's ad can compete for that query.
- **No paying for a spot already earned.** A product already in the top organic positions can't also win an ad slot, so the advertiser doesn't pay for traffic it was getting anyway. Organic ranking is computed before the auction and is never changed by it.
- **Ad load fits the layout:** 2 slots on comparison and browse pages, 1 on product focus, 0 when the query is out of scope or nothing matches.
- **Transparent:** the *Advertiser view* panel shows every campaign's bid, relevance, ad rank, outcome and the reason it won or lost.

Healthier ads (relevant, clearly labeled, capped) protect shopper trust. That trust is what lets an ads business grow inside AI answers.

See the auction code in [`prototype/src/engine.js`](../prototype/src/engine.js) (`buildPage`) and the per-query breakdown in the app's **Advertiser view** panel.

---
[← Back to the project overview](../README.md)
