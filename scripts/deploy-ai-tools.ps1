# ============================================
# SISMAIS AI - Deploy Script (PowerShell)
# ============================================
# Deploy das Edge Functions do Sismais AI Helpdesk
# ============================================

param(
    [string]$ProjectRef = "pomueweeulenslxvsxar"
)

$SUPABASE_URL = "https://$ProjectRef.supabase.co"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "SISMAIS AI - Deploy Script" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Funcoes de log
function Log-Success($message) {
    Write-Host "[OK] $message" -ForegroundColor Green
}

function Log-Warn($message) {
    Write-Host "[!] $message" -ForegroundColor Yellow
}

function Log-Error($message) {
    Write-Host "[ERRO] $message" -ForegroundColor Red
}

# ============================================
# 1. Deploy Edge Functions
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Deploying Edge Functions..." -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan

$FUNCTIONS = @(
    "agent-executor",
    "orchestrator",
    "uazapi-proxy",
    "process-incoming-message",
    "message-analyzer",
    "kanban-create-ticket",
    "kanban-update-ticket",
    "add-client-note",
    "escalate-to-human",
    "create-reminder",
    "schedule-callback",
    "send-email",
    "knowledge-search",
    "process-proactive-trigger",
    "ai-memory",
    "cto-advisor"
)

$deployedCount = 0
$failedCount = 0

foreach ($FUNC in $FUNCTIONS) {
    Write-Host "Deploying $FUNC... " -NoNewline
    $result = npx supabase functions deploy $FUNC --project-ref $ProjectRef 2>&1
    if ($LASTEXITCODE -eq 0) {
        Log-Success "$FUNC"
        $deployedCount++
    } else {
        Log-Error "$FUNC"
        $failedCount++
    }
}

# ============================================
# 2. Summary
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Deploy Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deployed: $deployedCount | Failed: $failedCount"
Write-Host ""
Write-Host "Functions deployed:"
foreach ($FUNC in $FUNCTIONS) {
    Write-Host "  - $FUNC"
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run migrations in Supabase Dashboard (SQL Editor)" -ForegroundColor White
Write-Host "  2. Configure cron jobs if needed" -ForegroundColor White
Write-Host "  3. Test the functions" -ForegroundColor White
Write-Host ""
