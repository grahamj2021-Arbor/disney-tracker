#!/bin/bash

SITE="https://disney-tracker-chi.vercel.app"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$DIR/heal-log.txt"
WORKER_NAME="disney-proxy"
WORKER_URL="https://disney-proxy.grahamj2021.workers.dev"
COMPAT_DATE="2024-01-01"
CHECK_INTERVAL=300

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

check_site() {
  local body
  body=$(curl -sf --max-time 15 "$SITE" 2>/dev/null)
  if echo "$body" | grep -qi "Disney World\|LIVE RIDE STATUS\|Magic Kingdom"; then
    return 0
  fi
  return 1
}

heal() {
  log "BROKEN: Site check failed — starting self-heal"

  # Check/redeploy Cloudflare Worker
  local worker_ok
  worker_ok=$(curl -sf --max-time 10 "$WORKER_URL?park=6" 2>/dev/null | grep -c "rides\|wait_time" || true)
  if [ "$worker_ok" -eq 0 ]; then
    log "Worker down — redeploying disney-proxy"
    cd "$DIR" && wrangler deploy worker.js --name "$WORKER_NAME" --compatibility-date "$COMPAT_DATE" >> "$LOG" 2>&1
  else
    log "Worker is up at $WORKER_URL"
  fi

  # Fix placeholder URL in index.html
  if grep -q "YOUR_WORKER_URL_HERE" "$DIR/index.html" 2>/dev/null; then
    log "Found placeholder in index.html — replacing with real worker URL"
    sed -i.bak "s|YOUR_WORKER_URL_HERE|$WORKER_URL|g" "$DIR/index.html"
    rm -f "$DIR/index.html.bak"
  fi

  # Commit, push, redeploy
  cd "$DIR"
  git add -A
  git commit -m "self-heal: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG" 2>&1 || log "Nothing new to commit"
  git push origin main >> "$LOG" 2>&1
  vercel --prod --yes >> "$LOG" 2>&1

  log "Self-heal complete — redeployed to Vercel"
}

log "Monitor starting (interval: ${CHECK_INTERVAL}s)"
while true; do
  if check_site; then
    log "OK: Site is healthy"
  else
    heal
  fi
  sleep "$CHECK_INTERVAL"
done
