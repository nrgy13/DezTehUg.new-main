#!/usr/bin/env bash
# DezTehYug CRM — MCP Health-Check
#
# Diagnoses MCP n8n connection (API key validity).
# Запуск: bash tools/check-mcp-health.sh

set -uo pipefail

N8N_URL="https://n8n.lex1case.ru"
MCP_JSON="$(dirname "$0")/../.mcp.json"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; FAILED=1; }
warn() { echo -e "${YELLOW}!${NC} $*"; }

FAILED=0

echo "═══ DezTehYug CRM — MCP Health-Check ═══"
echo

# ─── n8n API ────────────────────────────────────────────────────────────
echo "[1/1] n8n API ($N8N_URL)..."
if [ ! -f "$MCP_JSON" ]; then
  fail ".mcp.json not found at $MCP_JSON"
  echo "Подтяни конфиг с MCP n8n из санктум-репо или создай вручную."
  exit 1
fi

N8N_KEY=$(grep -oE '"N8N_API_KEY":\s*"[^"]+"' "$MCP_JSON" | head -1 | sed 's/.*"N8N_API_KEY":\s*"\([^"]*\)".*/\1/')
if [ -z "$N8N_KEY" ]; then
  fail "N8N_API_KEY not found in $MCP_JSON"
  exit 1
fi

HTTP_CODE=$(curl -s -o /tmp/n8n-health.out -w "%{http_code}" -H "X-N8N-API-KEY: $N8N_KEY" "${N8N_URL}/api/v1/workflows?limit=1")
if [[ "$HTTP_CODE" == "200" ]]; then
  COUNT=$(grep -oE '"id"' /tmp/n8n-health.out | wc -l)
  ok "n8n API reachable + auth OK (HTTP 200, sample workflows: $COUNT)"
elif [[ "$HTTP_CODE" == "401" ]]; then
  fail "n8n API auth failed (HTTP 401) — токен в .mcp.json истёк."
  echo "Что делать:"
  echo "  1. n8n UI → Settings → API → создай новый API Key"
  echo "  2. Замени значение N8N_API_KEY в .mcp.json"
  echo "  3. Перезапусти Claude Code (relaunch)"
elif [[ "$HTTP_CODE" == "000" ]]; then
  fail "n8n API unreachable — проверь сеть/прокси/VPN"
else
  fail "n8n API returned HTTP $HTTP_CODE — ответ: $(cat /tmp/n8n-health.out | head -c 200)"
fi

echo
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}═══ All checks passed ═══${NC}"
  echo "Если MCP n8n всё равно не отвечает в Claude Code — сделай relaunch."
  exit 0
else
  echo -e "${RED}═══ Checks failed ═══${NC}"
  exit 1
fi
