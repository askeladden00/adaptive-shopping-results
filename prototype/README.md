# Prototype

A single-page app with no build step and no dependencies: plain HTML, CSS and JavaScript.

## Run it

- **Online:** the [live demo](https://askeladden00.github.io/adaptive-shopping-results/prototype/) on GitHub Pages (rules baseline, or Gemini with your own key), or the [Claude version](https://claude.ai/artifact/1Co4jhFhPcwG2AGrXQkYSh) as a claude.ai artifact.
- **Locally:** from the repo root, run `python3 -m http.server 8000`, then open http://localhost:8000/prototype/.
- **Link to a query:** add `?q=` to the URL, for example [`?q=quiet espresso machine for a small kitchen`](https://askeladden00.github.io/adaptive-shopping-results/prototype/?q=quiet%20espresso%20machine%20for%20a%20small%20kitchen).

## Engines

Switch engines in the app header:
- **Claude:** uses the claude.ai artifact runtime, with no API key. Works only in the claude.ai artifact.
- **Gemini:** uses your own [Google AI Studio](https://aistudio.google.com/) API key, kept only in your browser's local storage. Works locally and on GitHub Pages. To check which models your key can call and how fast they answer, run `bash scripts/gemini-check.sh gemini-3.5-flash` (the key is read without echoing and never saved).
- **Rules baseline:** a keyword parser and templates with no LLM; the comparison point for evals.

## Code map

```
index.html          page and styles
src/catalog.js      48 fictional products, attribute vocabulary, 16 fictional campaigns
src/engine.js       schema guard, rules baseline, retrieval, ranking, ad auction, layouts, guardrail checks
src/llm.js          Claude and Gemini adapters, prompts, pipeline with fallback to the baseline
src/evals.js        41-case eval set, scoring, release gates, Markdown export
src/app.js          UI, eval runner, saving eval runs
scripts/gemini-check.sh   Gemini model and latency check
```

How the pieces fit together: [docs/how-it-works.md](../docs/how-it-works.md).

---
[← Back to the project overview](../README.md)
