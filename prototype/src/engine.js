// Deterministic core: intent schema guard, rules baseline, retrieval, ad auction,
// layout selection, refinement chips, template copy, and guardrail checks.
// The LLM never ranks products or places ads; it only fills the intent schema and writes copy.

const STAGES = ["explore", "compare", "buy"];
const RELEVANCE_FLOOR = 0.65;   // sponsored items below this relevance are never shown
const RESERVE_CPC = 0.25;       // minimum price per click
const AD_CAPS = { compare: 2, explore: 2, buy: 1, oos: 0, empty: 0 };
const ORGANIC_IN_VIEW = { compare: 3, explore: 4, buy: 0 }; // organic positions visible above the first ad
const LAYOUT_LABEL = {
  compare: "Comparison",
  explore: "Guided browse",
  buy: "Product focus",
  oos: "Out of scope",
  empty: "No exact matches",
};
const LAYOUT_WHY = {
  compare: "The shopper named specific needs or a budget, so a side-by-side table helps them decide.",
  explore: "The query is broad, so the page groups options by what tends to matter in this category.",
  buy: "The shopper named a specific product, so it leads with that product and close alternatives.",
  oos: "The demo catalog has no products for this query, so no results or ads are shown.",
  empty: "Nothing in the catalog meets every hard constraint. The page says so instead of quietly relaxing them.",
};

const round2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const uniq = (arr) => [...new Set(arr)];

// ---------- Intent schema guard ----------

function emptyIntent() {
  return { category: null, stage: "explore", budget_min: null, budget_max: null, must_have: [], nice_to_have: [], exclude: [], brand: null, product_ref: null, summary: "" };
}

// Validates any intent (LLM or rules) against the schema and vocabulary.
// Unknown tags are dropped and reported, so a model cannot invent retrieval filters.
function normalizeIntent(raw) {
  const issues = [];
  const it = emptyIntent();
  if (!raw || typeof raw !== "object") return { intent: it, issues: ["intent was not an object"] };

  it.category = CATEGORIES[raw.category] ? raw.category : null;
  if (raw.category && !it.category) issues.push(`unknown category "${raw.category}" treated as out of scope`);

  it.stage = STAGES.includes(raw.stage) ? raw.stage : "explore";
  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Math.round(Number(v)));
  it.budget_min = num(raw.budget_min);
  it.budget_max = num(raw.budget_max);
  if (it.budget_min !== null && it.budget_max !== null && it.budget_min > it.budget_max) {
    issues.push("budget_min > budget_max; swapped");
    [it.budget_min, it.budget_max] = [it.budget_max, it.budget_min];
  }

  const vocab = it.category ? VOCAB[it.category] : {};
  const cleanTags = (field) => {
    const tags = Array.isArray(raw[field]) ? raw[field].map(String) : [];
    const ok = uniq(tags.filter((t) => vocab[t]));
    const bad = tags.filter((t) => !vocab[t]);
    if (bad.length) issues.push(`${field}: dropped unknown tags ${bad.join(", ")}`);
    return ok;
  };
  it.must_have = cleanTags("must_have");
  it.nice_to_have = cleanTags("nice_to_have").filter((t) => !it.must_have.includes(t));
  it.exclude = cleanTags("exclude").filter((t) => !it.must_have.includes(t));

  const brands = it.category ? uniq(CATALOG.filter((p) => p.cat === it.category).map((p) => p.brand)) : [];
  if (raw.brand) {
    const b = brands.find((x) => x.toLowerCase() === String(raw.brand).toLowerCase());
    if (b) it.brand = b;
    else issues.push(`brand "${raw.brand}" not in catalog; ignored`);
  }
  if (raw.product_ref) {
    const p = PRODUCT_BY_ID[raw.product_ref];
    if (p && p.cat === it.category) it.product_ref = p.id;
    else issues.push(`product_ref "${raw.product_ref}" not found; ignored`);
  }
  if (it.stage === "buy" && !it.product_ref) {
    issues.push("stage buy without a product; using compare");
    it.stage = "compare";
  }
  it.summary = typeof raw.summary === "string" ? raw.summary.slice(0, 200) : "";
  return { intent: it, issues };
}

// ---------- Rules baseline intent parser ----------

const CATEGORY_PATTERNS = {
  running_shoes: /\b(running|runs?|runner|jog\w*|marathon|sneakers?|shoes?|race day|5k|10k)\b/,
  espresso_machines: /\b(espresso|latte|cappuccino|coffee|barista|crema)\b/,
  headphones: /\b(headphones?|earbuds?|buds|earphones?|anc|headset|noise cancel\w*)\b/,
};

const SYNONYMS = {
  running_shoes: {
    "stability": ["flat feet", "flat-footed", "overpronat", "arch support", "stability", "stable"],
    "max-cushion": ["cushion", "plush", "soft", "knee", "joint", "long run"],
    "lightweight": ["lightweight", "light weight", "lighter", "featherweight"],
    "wide-toe-box": ["wide", "roomy", "toe box"],
    "trail": ["trail", "hiking", "off-road", "mud"],
    "waterproof": ["waterproof", "rain", "wet", "gore-tex", "gtx"],
    "carbon-plate": ["carbon", "plate", "race day", "racing"],
    "beginner-friendly": ["beginner", "first pair", "just starting", "new to running", "starting out"],
    "durable": ["durable", "high mileage", "long lasting", "long-lasting"],
    "neutral": ["neutral"],
  },
  espresso_machines: {
    "compact": ["compact", "small kitchen", "small", "tiny", "apartment", "counter space"],
    "quiet": ["quiet", "silent", "noisy", "loud"],
    "milk-frother": ["milk", "latte", "cappuccino", "froth", "steam wand", "flat white"],
    "built-in-grinder": ["grinder", "grind"],
    "beginner-friendly": ["beginner", "easy to use", "new to espresso", "simple"],
    "manual-lever": ["lever", "manual"],
    "pod-compatible": ["pod", "capsule"],
    "fast-heatup": ["fast", "quick", "heat up", "heats up"],
    "dual-boiler": ["dual boiler", "double boiler"],
    "easy-clean": ["easy to clean", "easy clean", "low maintenance"],
  },
  headphones: {
    "noise-cancelling": ["noise cancel", "noise-cancel", "anc", "flight", "plane", "commute"],
    "over-ear": ["over-ear", "over ear"],
    "earbuds": ["earbud", "buds", "in-ear", "earphone"],
    "long-battery": ["battery", "all day"],
    "sweatproof": ["sweat", "gym", "workout"],
    "secure-fit": ["fall out", "secure", "stay in", "snug"],
    "lightweight": ["lightweight", "lighter", "light weight"],
    "multipoint": ["multipoint", "switch between", "two devices", "laptop and phone"],
    "call-quality": ["calls", "meetings", "mic", "zoom"],
    "low-latency": ["gaming", "lag", "latency", "games"],
    "foldable": ["fold", "travel case"],
    "wired-option": ["wired", "cable", "aux"],
  },
};
// Only feature-like tags can be negated ("no pods"); for the rest, "no lag" means the shopper wants the tag.
const NEGATABLE = new Set(["pod-compatible", "built-in-grinder", "carbon-plate", "wired-option", "manual-lever", "over-ear", "earbuds", "trail"]);

function parseBudget(q) {
  let m;
  if ((m = q.match(/between\s*\$?(\d+)\s*(?:and|-|to)\s*\$?(\d+)/)) || (m = q.match(/\$(\d+)\s*(?:-|–|to)\s*\$?(\d+)/))) {
    return { min: +m[1], max: +m[2] };
  }
  if ((m = q.match(/(?:around|about|roughly|~)\s*\$?(\d+)/))) return { min: null, max: Math.round(+m[1] * 1.1) };
  if ((m = q.match(/(?:under|below|less than|max|up to|no more than|<)\s*\$?(\d+)/))) return { min: null, max: +m[1] };
  if ((m = q.match(/budget\s*(?:of|is)?\s*\$?(\d+)/))) return { min: null, max: +m[1] };
  if ((m = q.match(/(?:over|above|more than)\s*\$?(\d+)/))) return { min: +m[1], max: null };
  return null;
}

function rulesIntent(query, prev) {
  const q = " " + query.toLowerCase() + " ";
  let category = null;
  // Brand or product names imply a category.
  const named = CATALOG.find((p) => q.includes(fullName(p).toLowerCase()));
  if (named) category = named.cat;
  if (!category) {
    const brandHit = CATALOG.find((p) => q.includes(p.brand.toLowerCase()));
    for (const [cat, re] of Object.entries(CATEGORY_PATTERNS)) if (re.test(q)) { category = cat; break; }
    if (!category && brandHit) category = brandHit.cat;
  }
  if (!category && prev) category = prev.category;

  const raw = prev ? JSON.parse(JSON.stringify(prev)) : emptyIntent();
  raw.category = category;
  if (prev && category !== prev.category) Object.assign(raw, emptyIntent(), { category });

  const b = parseBudget(q);
  if (b) { raw.budget_min = b.min; raw.budget_max = b.max; }

  if (category) {
    for (const [tag, words] of Object.entries(SYNONYMS[category])) {
      for (const w of words) {
        const idx = q.indexOf(w);
        if (idx < 0) continue;
        const before = q.slice(Math.max(0, idx - 9), idx);
        if (NEGATABLE.has(tag) && /\b(no|without|not|non-?)\s*$/.test(before)) {
          if (!raw.exclude.includes(tag)) raw.exclude.push(tag);
        } else if (!raw.must_have.includes(tag)) {
          raw.must_have.push(tag);
        }
        break;
      }
    }
    const brandHit = CATALOG.find((p) => p.cat === category && q.includes(p.brand.toLowerCase()));
    if (brandHit && !named) raw.brand = brandHit.brand;
  }

  raw.product_ref = named ? named.id : null;
  if (named) { raw.stage = "buy"; raw.must_have = []; }
  else if (raw.must_have.length || raw.budget_max || raw.budget_min || /\b(best|vs|compare|which|top)\b/.test(q)) raw.stage = "compare";
  else raw.stage = "explore";
  raw.summary = category ? `${CATEGORIES[category].label} matching the query keywords` : "";
  return raw;
}

// ---------- Retrieval, auction, layout ----------

function passesHardConstraints(p, it) {
  if (p.cat !== it.category) return false;
  if (it.budget_max !== null && p.price > it.budget_max) return false;
  if (it.budget_min !== null && p.price < it.budget_min) return false;
  if (it.brand && p.brand !== it.brand) return false;
  if (it.exclude.some((t) => p.attrs.includes(t))) return false;
  return true;
}

function scoreProduct(p, it, targetAttrs) {
  const must = targetAttrs || it.must_have;
  const matched = must.filter((t) => p.attrs.includes(t));
  const missing = must.filter((t) => !p.attrs.includes(t));
  const cov = must.length ? matched.length / must.length : 1;
  const nice = it.nice_to_have.length ? it.nice_to_have.filter((t) => p.attrs.includes(t)).length / it.nice_to_have.length : 0.5;
  const ratingNorm = clamp((p.rating - 3.5) / 1.5, 0, 1);
  const rel = round2(0.75 * cov + 0.1 * nice + 0.15 * ratingNorm);
  return { p, cov, rel, matched, missing };
}

function buildPage(it) {
  const page = { layout: null, cap: 0, organic: [], sponsored: [], auction: [], groups: [], hero: null, total: 0 };
  if (!it.category) { page.layout = "oos"; return page; }

  const ref = it.product_ref ? PRODUCT_BY_ID[it.product_ref] : null;
  const target = ref && !it.must_have.length ? ref.attrs : null;
  const pool = CATALOG.filter((p) => passesHardConstraints(p, ref ? { ...it, brand: null, budget_max: it.budget_max, budget_min: it.budget_min } : it) && (!ref || p.id !== ref.id));
  const scored = pool.map((p) => scoreProduct(p, it, target))
    .sort((a, b) => b.rel - a.rel || b.p.rating - a.p.rating || b.p.reviews - a.p.reviews);

  page.layout = ref ? "buy" : scored.length ? it.stage : "empty";
  if (page.layout === "buy" && !ref) page.layout = "compare";
  page.cap = AD_CAPS[page.layout];
  page.hero = ref;
  page.fullMatches = scored.filter((s) => s.cov === 1).length;

  // Organic ranking is computed first and never changed by ads. Products already in the
  // top organic positions can't also buy an ad slot (no paying for a spot they earned).
  const inView = new Set(scored.slice(0, ORGANIC_IN_VIEW[page.layout] || 0).map((s) => s.p.id));

  // Auction: ad rank = bid × relevance; second-price CPC; relevance floor gates eligibility.
  const inPool = new Map(scored.map((s) => [s.p.id, s]));
  const rows = CAMPAIGNS.filter((c) => PRODUCT_BY_ID[c.productId].cat === it.category).map((c) => {
    const p = PRODUCT_BY_ID[c.productId];
    const s = inPool.get(p.id) || scoreProduct(p, it, target);
    const row = { campaign: c, product: p, rel: s.rel, adRank: round2(c.bid * s.rel), status: "", cpc: null, slot: null };
    if (ref && p.id === ref.id) row.status = "Not shown: already the main result";
    else if (!inPool.has(p.id)) row.status = "Not shown: fails shopper's hard constraints";
    else if (inView.has(p.id)) row.status = "Not shown: already in top organic results";
    else if (s.rel < RELEVANCE_FLOOR) row.status = `Not shown: relevance ${s.rel.toFixed(2)} < floor ${RELEVANCE_FLOOR}`;
    else row.status = "eligible";
    return row;
  });
  const eligible = rows.filter((r) => r.status === "eligible").sort((a, b) => b.adRank - a.adRank);
  eligible.forEach((r, i) => {
    if (i < page.cap) {
      const next = eligible[i + 1];
      r.cpc = round2(Math.min(r.campaign.bid, Math.max(RESERVE_CPC, next ? next.adRank / r.rel + 0.01 : RESERVE_CPC)));
      r.slot = i + 1;
      r.status = `Won ad slot ${i + 1}`;
    } else {
      r.status = page.cap === 0 ? "Not shown: no ad slots on this layout" : "Not shown: outranked";
    }
  });
  page.auction = rows.sort((a, b) => (b.slot ? 1e3 - b.slot : b.adRank) - (a.slot ? 1e3 - a.slot : a.adRank));
  const winners = eligible.filter((r) => r.slot).map((r) => ({ ...inPool.get(r.product.id), sponsored: true, cpc: r.cpc, bid: r.campaign.bid }));
  page.sponsored = winners;
  const sponsoredIds = new Set(winners.map((w) => w.p.id));
  page.organic = scored.filter((s) => !sponsoredIds.has(s.p.id));
  page.total = scored.length;

  if (page.layout === "explore") {
    const counts = {};
    page.organic.forEach((s) => s.p.attrs.forEach((t) => { if (!it.must_have.includes(t)) counts[t] = (counts[t] || 0) + 1; }));
    const top = Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    page.groups = top.map((t) => ({ tag: t, items: page.organic.filter((s) => s.p.attrs.includes(t)).slice(0, 4) }));
  }
  return page;
}

function shownProducts(page) {
  const list = [...page.sponsored, ...page.organic.slice(0, 12)];
  page.groups.forEach((g) => list.push(...g.items));
  return list;
}

// Chips that split the current result set, so one tap narrows it.
function refinementChips(it, page) {
  if (!it.category || !page.organic.length) return [];
  const chips = [];
  const full = page.organic.filter((s) => s.cov === 1);
  const base = full.length >= 3 ? full : page.organic;
  const counts = {};
  base.forEach((s) => s.p.attrs.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
  Object.entries(counts)
    .filter(([t, n]) => !it.must_have.includes(t) && n / base.length >= 0.2 && n / base.length <= 0.75)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .forEach(([t]) => chips.push({ label: "+ " + ATTR_SHORT[t], op: "add", tag: t }));
  const prices = base.map((s) => s.p.price).sort((a, b) => a - b);
  if (prices.length >= 3) {
    const median = Math.floor(prices[Math.floor(prices.length / 2)] / 10) * 10;
    if (median > prices[0] && (it.budget_max === null || median < it.budget_max)) chips.push({ label: `Under $${median}`, op: "budget", value: median });
  }
  it.must_have.forEach((t) => chips.push({ label: "× " + ATTR_SHORT[t], op: "remove", tag: t }));
  return chips;
}

function applyChip(it, chip) {
  const n = JSON.parse(JSON.stringify(it));
  if (chip.op === "add") { n.must_have = uniq([...n.must_have, chip.tag]); if (n.stage === "explore") n.stage = "compare"; }
  if (chip.op === "remove") n.must_have = n.must_have.filter((t) => t !== chip.tag);
  if (chip.op === "budget") n.budget_max = chip.value;
  return n;
}

// ---------- Copy: template baseline ----------

function copyCandidates(page) {
  const organic = page.layout === "buy" ? page.organic.slice(0, 3) : page.organic.slice(0, 4);
  return { organic, sponsored: page.sponsored };
}

function templateCopy(it, page) {
  const { organic, sponsored } = copyCandidates(page);
  const copy = { overview: "", top_pick: null, notes: {}, reasons: {}, tip: "" };
  if (page.layout === "oos") { copy.overview = "This demo catalog only covers running shoes, espresso machines, and headphones."; return copy; }
  if (page.layout === "empty") { copy.overview = "No products meet all of your constraints. Try raising the budget or removing a requirement."; return copy; }
  const all = [...organic, ...sponsored];
  all.forEach((s) => {
    copy.reasons[s.p.id] = s.matched.length ? s.matched : s.p.attrs.slice(0, 2);
    copy.notes[s.p.id] = `${copy.reasons[s.p.id].map((t) => ATTR_SHORT[t]).join(", ")} · ${s.p.rating}★`;
  });
  if (page.layout === "buy") {
    copy.overview = `${fullName(page.hero)} is $${page.hero.price} and rated ${page.hero.rating}★. Similar options are below.`;
    return copy;
  }
  const top = organic[0];
  copy.top_pick = top ? top.p.id : null;
  const count = !it.must_have.length ? `${page.total} products match.`
    : page.fullMatches ? `${page.fullMatches} of ${page.total} products meet all your requirements.`
    : `None of the ${page.total} products meet every requirement; the closest matches are shown.`;
  copy.overview = top ? `${count} ${fullName(top.p)} ($${top.p.price}) ranks first for your stated needs.` : "";
  return copy;
}

// ---------- Guardrail checks (used live in the UI and by the eval runner) ----------

function checkPage(it, page, copy) {
  const shown = shownProducts(page);
  const res = {};

  const violations = shown.filter((s) => !passesHardConstraints(s.p, page.layout === "buy" ? { ...it, brand: null } : it));
  res.constraints = { pass: violations.length === 0, detail: violations.length ? `${violations.length} shown products break a hard constraint: ${violations.map((s) => s.p.id).join(", ")}` : "All shown products meet category, budget, brand and exclusion constraints" };

  const capOk = page.sponsored.length <= AD_CAPS[page.layout];
  const labelOk = page.sponsored.every((s) => s.sponsored === true);
  const noOrganicDupes = !page.sponsored.some((s) => page.organic.some((o) => o.p.id === s.p.id));
  res.ads = { pass: capOk && labelOk && noOrganicDupes, detail: `${page.sponsored.length} sponsored / cap ${AD_CAPS[page.layout]}${labelOk ? ", all labeled" : ", UNLABELED ad"}${noOrganicDupes ? "" : ", duplicate of organic"}` };

  const low = page.sponsored.filter((s) => s.rel < RELEVANCE_FLOOR);
  res.adRelevance = { pass: low.length === 0, detail: low.length ? `Ads below floor: ${low.map((s) => s.p.id).join(", ")}` : `All ads ≥ ${RELEVANCE_FLOOR} relevance` };

  const g = checkGrounding(copy, page, it);
  res.grounding = { pass: g.length === 0, detail: g.length ? g.join("; ") : "Copy cites only shown products, their real attributes and prices" };

  const sponsoredIds = new Set(page.sponsored.map((s) => s.p.id));
  const neutral = !copy.top_pick || !sponsoredIds.has(copy.top_pick);
  res.neutrality = { pass: neutral, detail: neutral ? "Top pick is an organic result" : `Top pick ${copy.top_pick} is a sponsored product` };
  return res;
}

function checkGrounding(copy, page, it) {
  const issues = [];
  const { organic, sponsored } = copyCandidates(page);
  const describable = new Map([...organic, ...sponsored].map((s) => [s.p.id, s.p]));
  if (page.hero) describable.set(page.hero.id, page.hero);
  const shownIds = new Set(shownProducts(page).map((s) => s.p.id).concat(page.hero ? [page.hero.id] : []));

  if (copy.top_pick && !shownIds.has(copy.top_pick)) issues.push(`top_pick ${copy.top_pick} is not on the page`);
  for (const [id, tags] of Object.entries(copy.reasons || {})) {
    const p = describable.get(id);
    if (!p) { issues.push(`reasons for ${id}, which is not on the page`); continue; }
    const bad = (tags || []).filter((t) => !p.attrs.includes(t));
    if (bad.length) issues.push(`${fullName(p)}: claimed ${bad.join(", ")} it doesn't have`);
  }
  for (const id of Object.keys(copy.notes || {})) if (!describable.has(id)) issues.push(`note for ${id}, which is not on the page`);

  const text = [copy.overview, copy.tip, ...Object.values(copy.notes || {})].join(" ");
  // Allowed dollar amounts: listed prices, the shopper's budget, and exact differences between them
  // ("costs $40 more" is grounded if two shown products are $40 apart).
  const base = [...describable.values()].map((p) => p.price).concat([it.budget_max, it.budget_min].filter((x) => x !== null));
  const allowedPrices = new Set(base);
  base.forEach((a) => base.forEach((b) => { if (a > b) allowedPrices.add(a - b); }));
  const prices = [...text.matchAll(/\$\s?(\d[\d,]*)/g)].map((m) => +m[1].replace(/,/g, ""));
  const badPrices = prices.filter((x) => !allowedPrices.has(x));
  if (badPrices.length) issues.push(`prices not on the page: $${badPrices.join(", $")}`);

  const lower = text.toLowerCase();
  const shownBrands = new Set([...shownIds].map((id) => PRODUCT_BY_ID[id].brand));
  const strayProducts = CATALOG.filter((p) => !shownIds.has(p.id) && lower.includes(fullName(p).toLowerCase()));
  if (strayProducts.length) issues.push(`mentions products not on the page: ${strayProducts.map(fullName).join(", ")}`);
  const strayBrands = uniq(CATALOG.map((p) => p.brand)).filter((b) => !shownBrands.has(b) && lower.includes(b.toLowerCase()));
  if (strayBrands.length) issues.push(`mentions brands not on the page: ${strayBrands.join(", ")}`);
  if (/sponsor|advertis|promoted|paid placement/.test(lower)) issues.push("copy talks about sponsorship (labels are the page's job)");
  return issues;
}
