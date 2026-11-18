#!/bin/bash
# Checks which Gemini "flash" models your API key can call, and how long one model takes
# to answer a tiny JSON request, with and without the "low thinking" setting the app sends.
# Usage: bash scripts/gemini-check.sh [model]     (default model: gemini-3.8-flash)
# The key is read silently (or from $GEMINI_API_KEY) and is never printed or saved.

MODEL="${1:-gemini-3.8-flash}"
if [ -z "$GEMINI_API_KEY" ]; then
  read -r -s -p "Paste your Gemini API key (hidden), then press Return: " GEMINI_API_KEY
  echo
fi
BASE="https://generativelanguage.googleapis.com/v1beta"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "== Flash models this key can call =="
curl -s --max-time 30 "$BASE/models?pageSize=200" -H "x-goog-api-key: $GEMINI_API_KEY" > "$TMP"
python3 - "$TMP" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print("  Couldn't read the model list."); sys.exit()
if "error" in d:
    print("  Error:", d["error"].get("message", d["error"])); sys.exit()
names = [m["name"].split("/")[-1] for m in d.get("models", [])
         if "generateContent" in m.get("supportedGenerationMethods", []) and "flash" in m["name"]]
print("\n".join("  " + n for n in sorted(names)) or "  (none found)")
PY

for THINK in low off; do
  if [ "$THINK" = off ]; then
    CFG='{"temperature":0.2,"responseMimeType":"application/json"}'
  else
    CFG='{"temperature":0.2,"responseMimeType":"application/json","thinkingConfig":{"thinkingLevel":"low"}}'
  fi
  BODY="{\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"Return the JSON {\\\"ok\\\": true}\"}]}],\"generationConfig\":$CFG}"
  echo "== $MODEL, thinking setting: $THINK =="
  RESULT=$(curl -s --max-time 90 -o "$TMP" -w "%{http_code} %{time_total}" \
    -X POST "$BASE/models/$MODEL:generateContent" \
    -H "Content-Type: application/json" -H "x-goog-api-key: $GEMINI_API_KEY" -d "$BODY")
  CODE="${RESULT%% *}"; SECS="${RESULT##* }"
  if [ "$CODE" = "000" ]; then
    echo "  No answer within 90 seconds."
  elif [ "$CODE" = "200" ]; then
    echo "  OK in ${SECS}s"
  else
    echo "  HTTP $CODE after ${SECS}s: $(head -c 300 "$TMP" | tr '\n' ' ')"
  fi
done
