param(
    [string]$ProjectRef = "pomueweeulenslxvsxar",
    [string]$Branch = "claude/sismais-support-system-JCMCi",
    [string]$Version = ""
)

if ([string]::IsNullOrEmpty($Version)) {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $Version = $packageJson.version
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Discord Push Notification" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$lastCommit = git log -1 --pretty="format:%h %s" 2>&1
Write-Host "Last commit: $lastCommit" -ForegroundColor Yellow

$changedFiles = git diff --name-only HEAD~1 HEAD 2>&1
$fileCount = ($changedFiles -split "`n").Count
Write-Host "Changed files: $fileCount" -ForegroundColor Yellow

$categories = @{
    "edge-functions" = @()
    "migrations" = @()
    "pages" = @()
    "components" = @()
    "hooks" = @()
    "scripts" = @()
    "frontend" = @()
    "other" = @()
}

foreach ($file in $changedFiles) {
    if ($file -match "supabase/functions") {
        $categories["edge-functions"] += $file
    } elseif ($file -match "supabase/migrations") {
        $categories["migrations"] += $file
    } elseif ($file -match "src/pages") {
        $categories["pages"] += $file
    } elseif ($file -match "src/components") {
        $categories["components"] += $file
    } elseif ($file -match "src/hooks") {
        $categories["hooks"] += $file
    } elseif ($file -match "scripts") {
        $categories["scripts"] += $file
    } elseif ($file -match "src/") {
        $categories["frontend"] += $file
    } else {
        $categories["other"] += $file
    }
}

$fields = @()
$fieldCount = 0

$categoryNames = @{
    "edge-functions" = "Edge Functions"
    "migrations" = "Migrations"
    "pages" = "Pages"
    "components" = "Components"
    "hooks" = "Hooks"
    "scripts" = "Scripts"
    "frontend" = "Frontend"
    "other" = "Outros"
}

foreach ($cat in $categories.Keys) {
    if ($categories[$cat].Count -gt 0) {
        $count = $categories[$cat].Count
        $files = $categories[$cat] -join "`n"
        $shortName = $categoryNames[$cat]
        
        $fields += @{
            name = "$shortName ($count)"
            value = $files
            inline = $false
        }
        $fieldCount++
        if ($fieldCount -ge 25) { break }
    }
}

$webhookUrl = $env:DISCORD_WEBHOOK_URL
if ([string]::IsNullOrEmpty($webhookUrl)) {
    Write-Host ""
    Write-Host "AVISO: DISCORD_WEBHOOK_URL nao configurado" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Preview da mensagem:" -ForegroundColor Cyan
    
    $embed = @{
        title = "Novo Deploy - v$Version"
        color = 3066993
        description = "Branch: $Branch"
        fields = $fields
        footer = @{
            text = "GMS Helpdesk"
        }
    }
    
    Write-Host ($embed | ConvertTo-Json -Depth 10)
    return
}

$payload = @{
    username = "GMS Deploy Bot"
    embeds = @(@{
        title = "Deploy Realizado - v$Version"
        color = 3066993
        url = "https://github.com/marciosaliver-dev/sismais-assist-chat/tree/$Branch"
        description = "Branch: $Branch"
        fields = $fields
        footer = @{
            text = "GMS Helpdesk | Deploy Automatico"
        }
        timestamp = (Get-Date -Format "o")
    })
}

$json = $payload | ConvertTo-Json -Depth 10 -Compress

Write-Host ""
Write-Host "Enviando notificacao para Discord..." -ForegroundColor Cyan

try {
    Invoke-RestMethod -Uri $webhookUrl -Method Post -ContentType "application/json" -Body ([System.Text.Encoding]::UTF8.GetBytes($json))
    Write-Host "Notificacao enviada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "Erro ao enviar: $_" -ForegroundColor Red
}
