# AI Leads System — One-command startup script
# Run this from the ai-leads-system folder:  .\start.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AI Business Website Acquisition      " -ForegroundColor Cyan
Write-Host "   System — Starting Up                 " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check Python 3.12 ────────────────────────────────────────────────────
$py = $null
try { $py = (Get-Command "py").Source } catch {}
$pyCmd = if ($py) { "py -3.12" } else { "python" }

Write-Host "[1/4] Installing backend packages..." -ForegroundColor Yellow
Set-Location "$root\backend"
Invoke-Expression "$pyCmd -m pip install -r requirements.txt -q"
Write-Host "      Backend packages ready." -ForegroundColor Green

# ── 2. Start backend ─────────────────────────────────────────────────────────
Write-Host "[2/4] Starting FastAPI backend on port 8000..." -ForegroundColor Yellow
$backend = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\backend'; $pyCmd -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0"
) -PassThru
Write-Host "      Backend PID: $($backend.Id)" -ForegroundColor Green

# ── 3. Install frontend packages (if needed) ─────────────────────────────────
Set-Location "$root\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "[3/4] Installing frontend packages (first run only)..." -ForegroundColor Yellow
    npm install --silent
} else {
    Write-Host "[3/4] Frontend packages already installed." -ForegroundColor Green
}

# ── 4. Start frontend ────────────────────────────────────────────────────────
Write-Host "[4/4] Starting Next.js frontend on port 3000..." -ForegroundColor Yellow
$frontend = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\frontend'; npm run dev"
) -PassThru
Write-Host "      Frontend PID: $($frontend.Id)" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  System is starting up!                " -ForegroundColor Green
Write-Host "                                        " -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3000       " -ForegroundColor White
Write-Host "  Backend:   http://localhost:8000       " -ForegroundColor White
Write-Host "  API Docs:  http://localhost:8000/docs  " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray

# Keep script alive
try { while ($true) { Start-Sleep 60 } }
finally {
    Write-Host "Stopping..." -ForegroundColor Yellow
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
}
