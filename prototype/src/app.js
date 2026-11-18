// UI: search results page, advertiser auction panel, eval runner, and explainer.

const EXAMPLES = [
  "quiet espresso machine for a small kitchen under $300",
  "running shoes for flat feet under $120",
  "earbuds for the gym that won't fall out",
  "headphones",
  "Brewlo Mini",
  "I get up at 5am and don't want my coffee machine to wake the kids",
];

const state = { engine: "rules", out: null, turns: [], busy: false, showAds: true, evalRuns: {}, lastEngineUsed: null, note: "" };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (x) => "$" + Number(x).toFixed(x % 1 ? 2 : 0);
const cents = (x) => "$" + Number(x).toFixed(2);
const ENGINE_LABEL = { claude: "Claude", gemini: "Gemini", rules: "Rules baseline" };

// ---------- Thumbnails ----------
const ICONS = {
  shoe: '<path d="M6 40c0-6 3-10 8-12l6-8c1-1 3-1 4 0l6 7c2 2 5 3 8 3h6c6 0 12 4 14 10v3c0 2-1 3-3 3H9c-2 0-3-1-3-3z"/><rect x="6" y="46" width="52" height="5" rx="2.5" opacity=".55"/>',
  espresso: '<rect x="12" y="8" width="40" height="10" rx="3"/><rect x="16" y="18" width="10" height="34" rx="2"/><rect x="30" y="20" width="12" height="5" rx="1.5"/><path d="M31 34h12v7a6 6 0 0 1-12 0z"/><rect x="12" y="52" width="40" height="5" rx="2" opacity=".55"/>',
  headphones: '<path d="M14 36v-6a18 18 0 0 1 36 0v6" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="9" y="33" width="12" height="19" rx="4"/><rect x="43" y="33" width="12" height="19" rx="4"/>',
};
function hue(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function thumb(p) {
  const h = hue(p.id + p.brand);
  return `<div class="thumb" style="background:hsl(${h} 45% 50% / .14);color:hsl(${h} 45% 40%)" aria-hidden="true"><svg viewBox="0 0 64 64" fill="currentColor">${ICONS[CATEGORIES[p.cat].icon]}</svg></div>`;
}

// ---------- Engine selection ----------
function setEngine(e) {
  state.engine = e;
  document.querySelectorAll("#engine-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.engine === e)));
  $("gemini-cfg").classList.toggle("on", e === "gemini");
  $("use-judge").disabled = e === "rules";
  if (e === "rules") $("use-judge").checked = false;
}
$("engine-seg").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-engine]");
  if (b && !b.disabled) setEngine(b.dataset.engine);
});
try {
  $("gemini-key").value = localStorage.getItem("gemini-key") || "";
  $("gemini-model").value = localStorage.getItem("gemini-model") || "gemini-3.5-flash";
} catch (e) { /* storage unavailable */ }
function syncGemini() {
  LLM.gemini.key = $("gemini-key").value.trim();
  const model = $("gemini-model").value.trim() || "gemini-3.5-flash";
  if (model !== LLM.gemini.model) LLM.gemini.thinkingOk = true; // re-check the thinking setting for a new model
  LLM.gemini.model = model;
  try { localStorage.setItem("gemini-key", LLM.gemini.key); localStorage.setItem("gemini-model", LLM.gemini.model); } catch (e) { /* ignore */ }
}
$("gemini-key").addEventListener("change", syncGemini);
$("gemini-model").addEventListener("change", syncGemini);
syncGemini();

if (window.claude && typeof window.claude.use === "function") {
  // Running as a claude.ai artifact: outside APIs are blocked here, so Gemini can't work.
  const g = $("eng-gemini");
  g.disabled = true;
  g.title = "Gemini runs only when the page is served locally or from GitHub Pages; claude.ai pages can't call outside APIs";
  if (state.engine === "gemini") setEngine("rules");
  try { localStorage.removeItem("gemini-key"); } catch (e) { /* ignore */ }
  $("gemini-key").value = "";
  LLM.gemini.key = "";
  window.claude.use("sample").then((s) => {
    if (!s) return;
    LLM.sample = s;
    const b = $("eng-claude");
    b.disabled = false;
    b.title = "Claude, via this artifact's runtime";
    setEngine("claude");
    state.note = "Showing the rules baseline. Search again (or tap an example) to see Claude's version.";
    renderResults();
  }).catch(() => {});
}

// ---------- Tabs ----------
document.querySelector(".tabs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-view]");
  if (!b) return;
  document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  ["shop", "evals", "how"].forEach((v) => ($("view-" + v).hidden = v !== b.dataset.view));
});

// ---------- Search flow ----------
EXAMPLES.forEach((ex) => {
  const b = document.createElement("button");
  b.className = "chip"; b.type = "button"; b.textContent = ex;
  b.addEventListener("click", () => { $("q").value = ex; search(ex); });
  $("examples").appendChild(b);
});
$("search-form").addEventListener("submit", (ev) => { ev.preventDefault(); const q = $("q").value.trim(); if (q) search(q); });

async function run(fn, label) {
  if (state.busy) return;
  state.busy = true; state.note = ""; state.error = null; state.loading = label;
  $("search-btn").disabled = true;
  renderResults();
  const t0 = Date.now();
  const tick = setInterval(() => { const el = $("elapsed"); if (el) el.textContent = Math.round((Date.now() - t0) / 1000); }, 1000);
  try { await fn(); } catch (e) {
    state.error = e.code === "not_granted" ? "Claude access was not granted for this page. Use the rules baseline, or allow access and try again."
      : e.code === "rate_limited" ? "The model is rate limited right now. Wait a minute and try again."
      : e.message || String(e);
  }
  clearInterval(tick);
  state.busy = false; state.loading = null; $("search-btn").disabled = false;
  renderResults();
}

function search(q) {
  return run(async () => {
    const out = await runPipeline(q, state.engine, null);
    state.out = out; state.turns = [q]; state.lastEngineUsed = state.engine;
  }, `Understanding “${q}”…`);
}
function followUp(text) {
  if (!state.out) return search(text);
  return run(async () => {
    const out = await runPipeline(text, state.engine, state.out.intent);
    out.query = state.turns.concat(text).join(" → ");
    state.out = out; state.turns.push(text); state.lastEngineUsed = state.engine;
  }, `Updating for “${text}”…`);
}
function chip(c) {
  return run(async () => {
    state.out = await rerunWithIntent(state.out, applyChip(state.out.intent, c), state.engine);
    state.turns.push(`[${c.label}]`); state.lastEngineUsed = state.engine;
  }, `Refining: ${c.label}…`);
}

// ---------- Rendering: results ----------
function productCard(s, copy, opts = {}) {
  const p = s.p;
  const reasons = (copy.reasons || {})[p.id];
  const highlight = new Set(reasons && reasons.length ? reasons : s.matched);
  const note = (copy.notes || {})[p.id];
  return `<article class="card pcard${s.sponsored ? " sp" : ""}">
    ${s.sponsored ? `<div class="splabel">Sponsored · ${esc(p.brand)}</div>` : ""}
    ${thumb(p)}
    ${opts.top ? '<span class="toppick">Top pick</span>' : ""}
    <div class="pbrand">${esc(p.brand)}</div>
    <div class="pname">${esc(p.name)}</div>
    <div class="prow"><span class="price">${money(p.price)}</span><span class="rating">${p.rating}★ (${p.reviews.toLocaleString()})</span></div>
    <div class="attrs">${p.attrs.map((t) => `<span class="tag${highlight.has(t) ? " must" : ""}">${esc(ATTR_SHORT[t])}</span>`).join("")}</div>
    ${s.missing && s.missing.length ? `<div class="partial">Missing: ${s.missing.map((t) => esc(ATTR_SHORT[t])).join(", ")}</div>` : ""}
    ${note ? `<p class="note">${esc(note)}</p>` : ""}
  </article>`;
}

function intentStrip(it, page) {
  if (!it.category) return `<div class="intent"><span class="k">Understood as</span><span class="tag">No category in this catalog</span><span class="tag layout">${LAYOUT_LABEL[page.layout]}</span></div>`;
  const parts = [`<span class="k">Understood as</span>`, `<span class="tag">${esc(CATEGORIES[it.category].label)}</span>`];
  if (it.budget_min !== null || it.budget_max !== null) parts.push(`<span class="tag">${it.budget_min !== null ? money(it.budget_min) : "$0"}–${it.budget_max !== null ? money(it.budget_max) : "any"}</span>`);
  it.must_have.forEach((t) => parts.push(`<span class="tag must">${esc(ATTR_SHORT[t])}</span>`));
  it.nice_to_have.forEach((t) => parts.push(`<span class="tag" title="Inferred, not required">${esc(ATTR_SHORT[t])}?</span>`));
  it.exclude.forEach((t) => parts.push(`<span class="tag excl">${esc(ATTR_SHORT[t])}</span>`));
  if (it.brand) parts.push(`<span class="tag">Brand: ${esc(it.brand)}</span>`);
  parts.push(`<span class="k">→ layout</span><span class="tag layout">${LAYOUT_LABEL[page.layout]}</span>`);
  return `<div class="intent">${parts.join("")}</div>`;
}

function comparisonTable(it, page, copy) {
  const cols = [...page.organic.slice(0, 3)];
  if (page.sponsored[0]) cols.push(page.sponsored[0]);
  if (!cols.length) return "";
  const shownTags = [...it.must_have];
  const counts = {};
  cols.forEach((s) => s.p.attrs.forEach((t) => { if (!shownTags.includes(t)) counts[t] = (counts[t] || 0) + 1; }));
  Object.entries(counts).filter(([, n]) => n < cols.length).sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([t]) => shownTags.push(t));
  const cls = (s) => (s.sponsored ? ' class="colsp"' : "");
  const head = cols.map((s) => `<th scope="col"${cls(s)}>${s.sponsored ? `<div class="splabel">Sponsored</div>` : copy.top_pick === s.p.id ? `<div class="splabel" style="color:var(--accent)">Top pick</div>` : ""}<div class="pbrand">${esc(s.p.brand)}</div><div class="pname">${esc(s.p.name)}</div></th>`).join("");
  const row = (label, f) => `<tr><th scope="row">${label}</th>${cols.map((s) => `<td${cls(s)}>${f(s)}</td>`).join("")}</tr>`;
  return `<div class="card ctable-wrap"><table class="ctable">
    <thead><tr><th></th>${head}</tr></thead>
    <tbody>
      ${row("Price", (s) => `<span class="price">${money(s.p.price)}</span>`)}
      ${row("Rating", (s) => `${s.p.rating}★ <span class="rating">(${s.p.reviews.toLocaleString()})</span>`)}
      ${shownTags.map((t) => row(esc(ATTR_SHORT[t]) + (it.must_have.includes(t) ? " *" : ""), (s) => (s.p.attrs.includes(t) ? '<span class="yes">✓</span>' : '<span class="no">–</span>'))).join("")}
      ${row("Specs", (s) => `<span class="mono" style="font-size:12px">${esc(s.p.spec)}</span>`)}
      ${row("Why", (s) => `<span class="note">${esc((copy.notes || {})[s.p.id] || "")}</span>`)}
    </tbody></table></div>
    ${it.must_have.length ? '<small class="why">* Your stated requirements</small>' : ""}`;
}

function layoutBody(it, page, copy) {
  if (page.layout === "oos") return `<div class="card" style="padding:16px">Nothing in this demo catalog matches. It covers running shoes, espresso machines and headphones. No ads are shown when there are no relevant results.</div>`;
  if (page.layout === "empty") {
    const relax = [];
    if (it.budget_max !== null || it.budget_min !== null) relax.push(`<button class="chip" data-relax="budget">Remove budget limit</button>`);
    it.must_have.forEach((t) => relax.push(`<button class="chip" data-relax="${esc(t)}">Drop “${esc(ATTR_SHORT[t])}”</button>`));
    if (it.exclude.length) relax.push(`<button class="chip" data-relax="exclude">Allow excluded features</button>`);
    return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">No products meet every constraint. The page doesn't silently relax them. Choose what to loosen:<div class="refine">${relax.join("")}</div></div>`;
  }
  if (page.layout === "compare") {
    const rest = page.organic.slice(3, 11);
    if (page.sponsored[1]) rest.splice(Math.min(1, rest.length), 0, page.sponsored[1]);
    return comparisonTable(it, page, copy) +
      (rest.length ? `<div class="section-h"><h2>More results</h2><small>${it.must_have.length ? `${page.fullMatches} of ${page.total} meet every requirement` : `${page.total} products match`}</small></div><div class="grid">${rest.map((s) => productCard(s, copy)).join("")}</div>` : "");
  }
  if (page.layout === "explore") {
    let html = "";
    const top = page.organic.slice(0, 4);
    html += `<div class="section-h"><h2>Top rated</h2><small>${page.total} products</small></div><div class="grid">${top.map((s) => productCard(s, copy, { top: copy.top_pick === s.p.id })).join("")}</div>`;
    if (page.sponsored.length) html += `<div class="section-h"><h2>Sponsored picks</h2><small>Ads that cleared the relevance floor</small></div><div class="grid">${page.sponsored.map((s) => productCard(s, copy)).join("")}</div>`;
    page.groups.forEach((g) => {
      html += `<div class="section-h"><h2>Shop by: ${esc(ATTR_SHORT[g.tag])}</h2><small>${esc(VOCAB[it.category][g.tag])}</small></div><div class="grid">${g.items.map((s) => productCard(s, copy)).join("")}</div>`;
    });
    return html;
  }
  if (page.layout === "buy") {
    const h = page.hero;
    const similar = page.organic.slice(0, 5);
    if (page.sponsored[0]) similar.unshift(page.sponsored[0]);
    return `<article class="card hero">${thumb(h)}<div style="display:flex;flex-direction:column;gap:8px">
        <div class="pbrand">${esc(h.brand)}</div><h2>${esc(h.name)}</h2>
        <div class="prow" style="justify-content:flex-start;gap:14px"><span class="price" style="font-size:22px">${money(h.price)}</span><span class="rating">${h.rating}★ (${h.reviews.toLocaleString()} reviews)</span></div>
        <div class="attrs">${h.attrs.map((t) => `<span class="tag must">${esc(ATTR_SHORT[t])}</span>`).join("")}</div>
        <div class="mono" style="font-size:12.5px;color:var(--muted)">${esc(h.spec)}</div>
        ${(copy.notes || {})[h.id] ? `<p class="note">${esc(copy.notes[h.id])}</p>` : ""}
      </div></article>
      ${similar.length ? `<div class="section-h"><h2>Compare similar</h2><small>Ranked by feature overlap with ${esc(h.name)}</small></div><div class="grid">${similar.map((s) => productCard(s, copy)).join("")}</div>` : ""}`;
  }
  return "";
}

function checksStrip(checks) {
  return `<div class="checks"><span class="k" style="color:var(--muted)">Live guardrail checks:</span>${GUARDRAILS.map((g) => `<span class="${checks[g].pass ? "ok" : "bad"}" title="${esc(checks[g].detail)}">${checks[g].pass ? "✓" : "✗"} ${GUARDRAIL_LABEL[g]}</span>`).join("")}</div>`;
}

function renderResults() {
  const el = $("results");
  const parts = [];
  if (state.loading) parts.push(`<div class="loading"><div class="spinner"></div>${esc(state.loading)} <span style="font-size:12px">(${ENGINE_LABEL[state.engine]} · <span id="elapsed">0</span>s)</span></div>`);
  if (state.error) parts.push(`<div class="notice err">${esc(state.error)}</div>`);
  if (state.note && !state.loading) parts.push(`<div class="notice">${esc(state.note)}</div>`);
  const o = state.out;
  if (o) {
    const { intent: it, page, copy } = o;
    if (o.fallback.length) parts.push(`<div class="notice warn">Fell back to the baseline for part of this answer: ${esc(o.fallback.join("; "))}</div>`);
    if (o.issues.length) parts.push(`<div class="notice warn">Schema guard corrected the model's intent: ${esc(o.issues.join("; "))}</div>`);
    if (state.turns.length > 1) parts.push(`<div class="turns">Conversation: ${state.turns.map((t) => `<b>${esc(t)}</b>`).join(" → ")}</div>`);
    parts.push(intentStrip(it, page));
    parts.push(`<p class="why">${esc(LAYOUT_WHY[page.layout])}${it.summary ? " Need: " + esc(it.summary) : ""}</p>`);
    const engineUsed = ENGINE_LABEL[state.lastEngineUsed] || "";
    parts.push(`<div class="card overview">
      <div class="eyebrow">${state.lastEngineUsed === "rules" ? "Summary · template (no LLM)" : `AI overview · ${esc(engineUsed)}`}</div>
      <p>${esc(copy.overview)}</p>
      ${copy.tip ? `<p class="tip">Tip: ${esc(copy.tip)}</p>` : ""}
      ${it.category ? `<form class="followup" id="followup"><input id="fu" placeholder="Follow up, e.g. “under $150 and lighter”" aria-label="Follow-up"><button type="submit">Refine</button></form>` : ""}
    </div>`);
    const chips = refinementChips(it, page);
    if (chips.length) parts.push(`<div class="refine"><span class="k">Refine:</span>${chips.map((c, i) => `<button class="chip" data-chip="${i}">${esc(c.label)}</button>`).join("")}</div>`);
    parts.push(layoutBody(it, page, copy));
    parts.push(checksStrip(o.checks));
    state.chips = chips;
  }
  el.innerHTML = parts.join("");
  const fu = $("followup");
  if (fu) fu.addEventListener("submit", (ev) => { ev.preventDefault(); const v = $("fu").value.trim(); if (v) followUp(v); });
  el.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => chip(state.chips[+b.dataset.chip])));
  el.querySelectorAll("[data-relax]").forEach((b) => b.addEventListener("click", () => {
    const r = b.dataset.relax, it = JSON.parse(JSON.stringify(state.out.intent));
    if (r === "budget") { it.budget_max = null; it.budget_min = null; } else if (r === "exclude") it.exclude = []; else it.must_have = it.must_have.filter((t) => t !== r);
    run(async () => {
      state.out = await rerunWithIntent(state.out, it, state.engine);
      state.turns.push(`[${b.textContent}]`); state.lastEngineUsed = state.engine;
    }, "Relaxing constraints…");
  }));
  renderAdPanel();
}

function renderAdPanel() {
  const panel = $("adpanel");
  $("shop-grid").classList.toggle("with-ads", state.showAds);
  panel.hidden = !state.showAds;
  const o = state.out;
  if (!o) { panel.innerHTML = ""; return; }
  const page = o.page;
  const rows = page.auction;
  const spend = page.sponsored.reduce((a, s) => a + s.cpc, 0);
  panel.innerHTML = `<h2>Advertiser view</h2>
    <p>Ad rank = max CPC bid × relevance to this shopper's intent. Ads below ${RELEVANCE_FLOOR} relevance are never shown, whatever the bid. Winners pay the second price. This layout has ${page.cap} ad slot${page.cap === 1 ? "" : "s"}.</p>
    ${rows.length ? `<div style="overflow-x:auto"><table>
      <thead><tr><th>Campaign</th><th class="num">Bid</th><th class="num">Rel.</th><th class="num">Rank</th><th class="num">CPC</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td><b>${esc(r.campaign.advertiser)}</b> · ${esc(r.product.name)}<div class="${r.slot ? "won" : "lost"}" style="font-size:11.5px">${esc(r.status)}</div></td>
        <td class="num">${cents(r.campaign.bid)}</td><td class="num">${r.rel.toFixed(2)}</td><td class="num">${r.adRank.toFixed(2)}</td><td class="num">${r.cpc !== null ? cents(r.cpc) : "–"}</td></tr>`).join("")}</tbody>
    </table></div>` : `<p>No campaigns compete for this query.</p>`}
    <p>${page.sponsored.length ? `Revenue if each shown ad is clicked once: <b class="mono">${cents(spend)}</b>.` : "No ad met the bar for this query, so none is shown."} Intent-matched ads can beat higher bids: relevance is part of the price.</p>
    <label class="switch"><input type="checkbox" id="hide-ads"> Hide advertiser view</label>`;
  $("hide-ads").addEventListener("change", () => { state.showAds = false; renderAdPanel(); addShowAdsToggle(); });
}
function addShowAdsToggle() {
  if ($("show-ads")) return;
  const b = document.createElement("button");
  b.id = "show-ads"; b.className = "chip"; b.type = "button"; b.textContent = "Show advertiser view";
  b.addEventListener("click", () => { state.showAds = true; b.remove(); renderAdPanel(); });
  $("examples").appendChild(b);
}

// ---------- Evals ----------
let lastMd = "";
$("run-evals").addEventListener("click", async () => {
  const engine = state.engine, withJudge = $("use-judge").checked && engine !== "rules";
  $("run-evals").disabled = true; $("eval-status").hidden = false;
  const results = [];
  let stopped = null;
  // Gemini runs are paced to fit a free-tier per-minute limit, and wait out 429s instead of stopping.
  const paced = engine === "gemini";
  const started = Date.now();
  let caseText = "";
  const showStatus = (wait) => {
    const mins = Math.floor((Date.now() - started) / 60000);
    $("eval-status-text").textContent = caseText
      + (paced ? ` (paced for the free tier, ${mins} min so far)` : "")
      + (wait ? `. ${wait}` : "");
  };
  LLM.gemini.paced = paced;
  LLM.gemini.onWait = (reason, secs) => showStatus(reason ? `${reason}: waiting ${secs}s, then retrying` : "");
  for (let i = 0; i < EVALSET.length; i++) {
    caseText = `${ENGINE_LABEL[engine]}: case ${i + 1} of ${EVALSET.length}`;
    showStatus("");
    $("eval-bar").style.width = `${(i / EVALSET.length) * 100}%`;
    try { results.push(await runEvalCase(EVALSET[i], engine, withJudge)); }
    catch (e) {
      stopped = e.code === "rate_limited"
        ? (e.daily ? "Stopped early: " + e.message : "Stopped early: the model was still rate limited after waiting.")
        : e.code === "not_granted" ? "Stopped: Claude access was not granted." : "Stopped: " + (e.message || e.code);
      break;
    }
  }
  LLM.gemini.paced = false; LLM.gemini.onWait = null;
  $("eval-bar").style.width = "100%";
  $("eval-status").hidden = true; $("run-evals").disabled = false;
  if (!results.length) { $("eval-out").innerHTML = `<div class="notice err">${esc(stopped)}</div>`; return; }
  const s = summarize(results, ENGINE_LABEL[engine]);
  state.evalRuns[engine] = { results, s };
  lastMd = resultsMarkdown(results, s);
  $("copy-md").disabled = false;
  renderEvals(engine, stopped);
  saveRun(engine, s, lastMd, stopped);
});
$("copy-md").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(lastMd); $("copy-md").textContent = "Copied"; }
  catch (e) { $("copy-md").textContent = "Copy failed"; }
  setTimeout(() => ($("copy-md").textContent = "Copy results as Markdown"), 1500);
});

function renderEvals(engine, stopped) {
  const { results, s } = state.evalRuns[engine];
  const tiles = [`<div class="card tile verdict ${s.verdict.toLowerCase()}"><div class="v">${s.verdict}</div><div class="l">Release gate · ${esc(s.engine)} · ${s.n} cases</div></div>`]
    .concat(s.gates.map((g) => `<div class="card tile"><div class="v">${fmtVal(g.value, g.fmt)}</div><div class="l">${esc(g.name)}</div><div class="t ${g.pass ? "ok" : "bad"}" style="display:inline-block;margin-top:4px">target ${fmtVal(g.target, g.fmt)}</div></div>`));
  const others = Object.entries(state.evalRuns);
  const cmp = others.length > 1 ? `<h3 style="margin:18px 0 8px;font-size:16px">Engines compared (this session)</h3><div class="card" style="overflow-x:auto"><table class="cmp">
      <thead><tr><th>Metric</th>${others.map(([, r]) => `<th>${esc(r.s.engine)}</th>`).join("")}</tr></thead><tbody>
      ${[["Verdict", (x) => x.verdict], ["Exact intent, held-out", (x) => fmtVal(x.heldout.intentExact, "pct")], ["Must-have F1, held-out", (x) => fmtVal(x.heldout.mustF1, "num")], ["Exact intent, dev set", (x) => fmtVal(x.dev.intentExact, "pct")], ["Exact intent, all", (x) => fmtVal(x.intentExact, "pct")], ["Category", (x) => fmtVal(x.category, "pct")], ["Budget", (x) => fmtVal(x.budget, "pct")], ["Stage / layout", (x) => fmtVal(x.stage, "pct")], ["All guardrails pass", (x) => fmtVal(x.guardAll, "pct")], ["Judge (1-5)", (x) => fmtVal(x.judge, "num")], ["Median ms / case", (x) => x.msMedian]]
        .map(([l, f]) => `<tr><th scope="row">${l}</th>${others.map(([, r]) => `<td class="mono">${f(r.s)}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>` : "";
  const rows = results.map((r, i) => {
    const q = r.case.q + (r.case.followup ? ` → “${r.case.followup}”` : "");
    return `<tr class="case" data-i="${i}" tabindex="0"><td class="mono">${r.case.id}</td><td>${esc(q)}${r.case.tags ? ` <span class="tag">${esc(r.case.tags.join(", "))}</span>` : ""}</td>
      <td>${r.intent.exact ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td><td class="mono">${r.intent.must.toFixed(2)}</td>
      <td><span class="dots">${GUARDRAILS.map((g) => `<span class="dot${r.guard[g].pass ? "" : " f"}" title="${esc(GUARDRAIL_LABEL[g] + ": " + r.guard[g].detail)}"></span>`).join("")}</span></td>
      <td class="mono">${r.judge?.score ?? "–"}</td><td class="mono">${r.ms}</td></tr>
      <tr class="detail" id="detail-${i}" hidden><td colspan="7"><div class="cols">
        <div><b>Gold</b><pre>${esc(JSON.stringify(r.case.gold, null, 1))}</pre></div>
        <div><b>Predicted intent</b><pre>${esc(JSON.stringify(r.out.intent, null, 1))}</pre></div>
        <div><b>Guardrails</b><pre>${esc(GUARDRAILS.map((g) => `${r.guard[g].pass ? "✓" : "✗"} ${GUARDRAIL_LABEL[g]}: ${r.guard[g].detail}`).join("\n"))}</pre>
        <b>Overview</b><pre>${esc(r.out.copy.overview)}</pre>${r.judge ? `<b>Judge</b><pre>${esc(r.judge.score + " · " + r.judge.reason)}</pre>` : ""}${r.out.fallback.length ? `<b>Fallbacks</b><pre>${esc(r.out.fallback.join("\n"))}</pre>` : ""}</div>
      </div></td></tr>`;
  }).join("");
  $("eval-out").innerHTML = `${stopped ? `<div class="notice warn">${esc(stopped)} Results below cover ${results.length} cases.</div>` : ""}
    <div class="tiles">${tiles.join("")}</div>
    <div class="checks"><span class="k" style="color:var(--muted)">Guardrail pass rates:</span>${GUARDRAILS.map((g) => `<span class="${s.guard[g] === 1 ? "ok" : "bad"}">${GUARDRAIL_LABEL[g]} ${fmtVal(s.guard[g], "pct")}</span>`).join("")}<span class="k" style="color:var(--muted)">Exact intent: dev ${fmtVal(s.dev.intentExact, "pct")} · held-out ${fmtVal(s.heldout.intentExact, "pct")} · Fallbacks: ${s.fallbacks} · median ${s.msMedian} ms/case</span></div>
    ${cmp}
    <h3 style="margin:18px 0 8px;font-size:16px">Cases <small style="font-weight:400;color:var(--muted);font-size:13px">select a row for gold vs predicted</small></h3>
    <div class="card" style="overflow-x:auto"><table class="etable"><thead><tr><th>ID</th><th>Query</th><th>Intent</th><th>Must F1</th><th>Guardrails</th><th>Judge</th><th>ms</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $("eval-out").querySelectorAll("tr.case").forEach((tr) => {
    const toggle = () => { const d = $("detail-" + tr.dataset.i); d.hidden = !d.hidden; };
    tr.addEventListener("click", toggle);
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
}

// Saves each eval run to the artifact's database (when the page runs as a claude.ai artifact),
// so runs persist across visits and can be read back for reporting.
let dbPromise = null;
if (window.claude && typeof window.claude.use === "function") dbPromise = window.claude.use("db").catch(() => null);
async function saveRun(engine, s, md, stopped) {
  const db = dbPromise ? await dbPromise : null;
  if (!db) return;
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + engine;
  try {
    await db.doc("evalruns/" + id).set({
      engine, at: new Date().toISOString(), verdict: s.verdict, cases: s.n, stopped: stopped || null,
      heldoutIntentExact: s.heldout.intentExact, heldoutMustF1: s.heldout.mustF1, devIntentExact: s.dev.intentExact,
      guardAll: s.guardAll, guard: s.guard, judge: s.judge, rawGroundingFails: s.rawGroundingFails, llmCopyCases: s.llmCopyCases, markdown: md,
    });
    $("eval-out").insertAdjacentHTML("afterbegin", `<div class="notice">Saved this run to the artifact's database.</div>`);
  } catch (e) {
    $("eval-out").insertAdjacentHTML("afterbegin", `<div class="notice warn">Couldn't save this run: ${esc(e.message || e.code || e)}</div>`);
  }
}

// ---------- How it works ----------
$("view-how").innerHTML = `
  <h2>How it works</h2>
  <p>A shopper types what they need in their own words. An LLM turns that into a structured intent: category, budget, required and excluded features, and funnel stage. Everything after that is deterministic code: retrieval, ranking, the ad auction, layout choice and ad labeling. The LLM comes back at the end to write a short overview grounded in the products on the page.</p>
  <div class="flow">
    <div class="card step llm"><span class="who">LLM</span><b>1. Understand intent</b>Vague words to schema tags (“wake the kids” → quiet)</div>
    <div class="card step"><span class="who">Code</span><b>2. Schema guard</b>Drops unknown tags, invalid brands and products</div>
    <div class="card step"><span class="who">Code</span><b>3. Retrieve + rank</b>Hard constraints filter; relevance = fit + rating</div>
    <div class="card step"><span class="who">Code</span><b>4. Ad auction</b>Bid × relevance, relevance floor, second price, slot cap</div>
    <div class="card step"><span class="who">Code</span><b>5. Choose layout</b>Comparison, guided browse or product focus</div>
    <div class="card step llm"><span class="who">LLM</span><b>6. Write overview</b>Grounded copy; top pick must be organic</div>
    <div class="card step"><span class="who">Code</span><b>7. Guardrail checks</b>Run on every page, live and in evals</div>
  </div>
  <p><b>Why split it this way.</b> Ranking and ad placement stay in code, so ads can't be invented, unlabeled, or pushed past their relevance floor by a prompt, including a prompt-injection query (case E24). The LLM does the part rules do badly: turning “I get up at 5am and don't want to wake the kids” into a need for a quiet machine.</p>
  <p><b>Shopper value.</b> Fewer reformulated searches. The page shape fits the job: a comparison table when the shopper has requirements, guided browsing when they don't, and a product focus when they name one. One-tap refinements split the remaining options.</p>
  <p><b>Advertiser value.</b> Ads compete on fit, not only on bid. A relevant product with a lower bid can beat a higher bid for an irrelevant one (try “running shoes for flat feet under $120”: the $2.40 carbon racer is filtered out). Intent-level targeting lets an advertiser reach shoppers who never typed a keyword they bid on.</p>
  <p><b>Data.</b> A 48-product sample catalog with fictional brands and 16 fictional campaigns, written for this prototype. No real merchant, advertiser or employer data.</p>
  <p class="foot">Engines: Claude runs through the claude.ai artifact runtime. Gemini needs your own API key and works when the page runs locally or on GitHub Pages (claude.ai pages can't call outside APIs). The rules baseline is a keyword parser used as the comparison point in the evals.</p>`;

// ---------- Boot ----------
setEngine("rules");
// ?q=... opens the page on that query (used by links in the README).
const startQuery = (new URLSearchParams(location.search).get("q") || "").trim().slice(0, 200) || EXAMPLES[0];
$("q").value = startQuery;
search(startQuery);
