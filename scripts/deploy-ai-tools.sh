#!/bin/bash
# ============================================
# SISMAIS AI - Deploy Script
# ============================================
# Este script faz deploy de todas as melhorias
# do sistema Sismais AI Helpdesk
# ============================================

set -e

PROJECT_REF="pomueweeulenslxvsxar"
SUPABASE_URL="https://$PROJECT_REF.supabase.co"

echo "============================================"
echo "🚀 SISMAIS AI - Deploy Script"
echo "============================================"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função de log
log() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ============================================
# 1. Deploy Edge Functions
# ============================================
echo ""
echo "============================================"
echo "📦 Deploying Edge Functions..."
echo "============================================"

FUNCTIONS=(
    "agent-executor"
    "orchestrator"
    "uazapi-proxy"
    "process-incoming-message"
    "message-analyzer"
    "kanban-create-ticket"
    "kanban-update-ticket"
    "add-client-note"
    "escalate-to-human"
    "create-reminder"
    "schedule-callback"
    "send-email"
    "knowledge-search"
    "process-proactive-trigger"
)

for FUNC in "${FUNCTIONS[@]}"; do
    echo "Deploying $FUNC..."
    if npx supabase functions deploy "$FUNC" --project-ref "$PROJECT_REF" 2>&1 | tail -2; then
        log "Deployed: $FUNC"
    else
        error "Failed: $FUNC"
    fi
done

# ============================================
# 2. Deploy Shared Modules
# ============================================
echo ""
echo "============================================"
echo "📦 Deploying Shared Modules..."
echo "============================================"

npx supabase functions deploy agent-executor --project-ref "$PROJECT_REF" 2>&1 | tail -2

# ============================================
# 3. Summary
# ============================================
echo ""
echo "============================================"
echo "✅ Deploy Complete!"
echo "============================================"
echo ""
echo "Functions deployed:"
for FUNC in "${FUNCTIONS[@]}"; do
    echo "  - $FUNC"
done
echo ""
echo "Next steps:"
echo "  1. Run migrations in Supabase Dashboard"
echo "  2. Configure cron jobs"
echo "  3. Test the functions"
echo ""
