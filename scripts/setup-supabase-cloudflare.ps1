# Supabase + Cloudflare 一键配置脚本 (Windows PowerShell)
# 用法: .\scripts\setup-supabase-cloudflare.ps1

param(
    [switch]$SkipCloudflare,
    [switch]$LocalOnly,
    [string]$SiteUrl = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root ".env.local"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Conan AI - Supabase + Cloudflare 配置向导" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------- Step 1: Supabase 项目 ----------
Write-Host "[1/5] Supabase 项目" -ForegroundColor Yellow
Write-Host "  若尚未创建项目，请打开: https://supabase.com/dashboard/new" -ForegroundColor Gray
Write-Host "  创建后进入 Project Settings -> API，复制 URL 和 Keys" -ForegroundColor Gray
Write-Host ""

$supabaseUrl = Read-Host "NEXT_PUBLIC_SUPABASE_URL (例: https://xxx.supabase.co)"
$anonKey = Read-Host "NEXT_PUBLIC_SUPABASE_ANON_KEY (anon public)"
$serviceKey = Read-Host "SUPABASE_SERVICE_ROLE_KEY (service_role，仅服务端)"

if (-not $supabaseUrl -or -not $anonKey -or -not $serviceKey) {
    Write-Host "错误: 三个 Supabase 变量均为必填" -ForegroundColor Red
    exit 1
}

$projectRef = ""
if ($supabaseUrl -match "https://([^.]+)\.supabase\.co") {
    $projectRef = $Matches[1]
}

# ---------- Step 2: 写入 .env.local ----------
Write-Host ""
Write-Host "[2/5] 写入 .env.local" -ForegroundColor Yellow

$existing = @{}
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') {
            $existing[$Matches[1]] = $Matches[2]
        }
    }
}

$existing["NEXT_PUBLIC_SUPABASE_URL"] = $supabaseUrl
$existing["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = $anonKey
$existing["SUPABASE_SERVICE_ROLE_KEY"] = $serviceKey

if (-not $existing.ContainsKey("SILICONFLOW_API_KEY")) {
    $sfKey = Read-Host "SILICONFLOW_API_KEY (硅基流动，本地开发必需)"
    if ($sfKey) { $existing["SILICONFLOW_API_KEY"] = $sfKey }
}

$lines = @()
$lines += "# Generated/updated by setup-supabase-cloudflare.ps1"
$lines += "# $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
$lines += ""
foreach ($key in ($existing.Keys | Sort-Object)) {
    $lines += "$key=$($existing[$key])"
}
Set-Content -Path $EnvFile -Value ($lines -join "`n") -Encoding UTF8
Write-Host "  已更新 $EnvFile" -ForegroundColor Green

# ---------- Step 3: SQL 迁移提示 ----------
Write-Host ""
Write-Host "[3/5] 执行数据库迁移" -ForegroundColor Yellow
$sqlPath = Join-Path $Root "supabase\migrations\000_combined_all.sql"
Write-Host "  请在 Supabase SQL Editor 中执行合并迁移文件:" -ForegroundColor Gray
Write-Host "  $sqlPath" -ForegroundColor White
if ($projectRef) {
    $sqlEditorUrl = "https://supabase.com/dashboard/project/$projectRef/sql/new"
    Write-Host "  直接打开: $sqlEditorUrl" -ForegroundColor Cyan
    $open = Read-Host "是否用浏览器打开 SQL Editor? (y/n)"
    if ($open -eq "y") { Start-Process $sqlEditorUrl }
}
Write-Host ""
Write-Host "  复制 000_combined_all.sql 全部内容 -> 粘贴 -> Run" -ForegroundColor Gray
Read-Host "迁移执行完成后按 Enter 继续"

# ---------- Step 4: Auth 回调 URL ----------
Write-Host ""
Write-Host "[4/5] 配置 Supabase Auth 回调" -ForegroundColor Yellow
if (-not $SiteUrl) {
    $SiteUrl = Read-Host "Cloudflare Workers URL (例: https://mystery-game.xxx.workers.dev，本地测试填 http://localhost:3000)"
}
$callbackUrls = @(
    "http://localhost:3000/auth/callback",
    "$SiteUrl/auth/callback"
) | Select-Object -Unique

Write-Host "  在 Supabase -> Authentication -> URL Configuration 添加:" -ForegroundColor Gray
Write-Host "  Site URL: $SiteUrl" -ForegroundColor White
foreach ($u in $callbackUrls) {
    Write-Host "  Redirect URL: $u" -ForegroundColor White
}
if ($projectRef) {
    $authUrl = "https://supabase.com/dashboard/project/$projectRef/auth/url-configuration"
    Write-Host "  配置页: $authUrl" -ForegroundColor Cyan
    $openAuth = Read-Host "是否用浏览器打开 Auth 配置? (y/n)"
    if ($openAuth -eq "y") { Start-Process $authUrl }
}
Read-Host "Auth 配置完成后按 Enter 继续"

# ---------- Step 5: Cloudflare 环境变量 ----------
if ($LocalOnly) {
    Write-Host ""
    Write-Host "跳过 Cloudflare（-LocalOnly）" -ForegroundColor Gray
} elseif ($SkipCloudflare) {
    Write-Host ""
    Write-Host "跳过 Cloudflare（-SkipCloudflare）" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "[5/5] 同步 Cloudflare Workers 密钥" -ForegroundColor Yellow

    Push-Location $Root
    try {
        Write-Host "  检查 Wrangler 登录状态..." -ForegroundColor Gray
        npx wrangler whoami 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  请先登录: npx wrangler login" -ForegroundColor Yellow
            npx wrangler login
        }

        function Set-WranglerSecret([string]$Name, [string]$Value) {
            if (-not $Value) { return }
            Write-Host "  设置 $Name..." -ForegroundColor Gray
            $Value | npx wrangler secret put $Name 2>&1
        }

        Set-WranglerSecret "NEXT_PUBLIC_SUPABASE_URL" $supabaseUrl
        Set-WranglerSecret "NEXT_PUBLIC_SUPABASE_ANON_KEY" $anonKey
        Set-WranglerSecret "SUPABASE_SERVICE_ROLE_KEY" $serviceKey
        if ($existing.ContainsKey("SILICONFLOW_API_KEY")) {
            Set-WranglerSecret "SILICONFLOW_API_KEY" $existing["SILICONFLOW_API_KEY"]
        }

        Write-Host "  Cloudflare 密钥已同步" -ForegroundColor Green
        Write-Host ""
        $redeploy = Read-Host "是否立即部署? (y/n)"
        if ($redeploy -eq "y") {
            npm run deploy
        }
    } catch {
        Write-Host "  Cloudflare 同步失败: $_" -ForegroundColor Red
        Write-Host "  请手动在 Cloudflare Dashboard -> Workers -> Settings -> Variables 添加上述变量" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " 配置完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "本地验证: npm run dev -> http://localhost:3000" -ForegroundColor Gray
Write-Host "Workers 预览: npm run preview" -ForegroundColor Gray
Write-Host ""
