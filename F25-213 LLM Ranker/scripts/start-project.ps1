<#
.SYNOPSIS
Starts the LLM-RANKER stack: Python rankers, Express API (Node), Vite client.

.DESCRIPTION
Opens four windows by default:
  - rank_transformers_service.py (5056) — scores batches from SQLite after /rank-responses
  - ranking_service.py (5055) — POST /rank for dataset Train & CrossEncoder from Node (RANKING_SERVICE_URL)
  - Node API, Vite

Ensure server\.env has RANK_TRANSFORMERS_SERVICE_URL=http://127.0.0.1:5056
Optional: RANKING_SERVICE_URL=http://127.0.0.1:5055 (default if unset)

.PARAMETER SkipPython
Skip starting both Python services (live ranking + dataset train fall back to placeholder scores).

.EXAMPLE
  .\scripts\start-project.ps1
  .\scripts\start-project.ps1 -SkipPython
#>
param(
    [switch]$SkipPython
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

if (-not $PSScriptRoot) {
    Write-Error "Run this script from disk (not piped)."
    exit 1
}

$RepoRoot = Split-Path -Parent (Resolve-Path $PSScriptRoot)
$PythonDir = Join-Path $RepoRoot "server\python"
$ServerDir = Join-Path $RepoRoot "server"
$ClientDir = Join-Path $RepoRoot "client"

function Start-ServiceWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Arguments
    )
    $exe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    Start-Process -FilePath $exe -WorkingDirectory $WorkingDirectory -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle='$Title'; Set-Location -LiteralPath '$WorkingDirectory'; $Arguments"
    ) | Out-Null
}

Write-Host ""
Write-Host "Repo: $RepoRoot" -ForegroundColor Cyan

if (-not $SkipPython) {
    Write-Host "[1/4] Opening Python ranker (SQLite batch, port 5056) …" -ForegroundColor Green
    Start-ServiceWindow -Title "LLM-RANKER: Python ranker (5056)" -WorkingDirectory $PythonDir `
        -Arguments "python rank_transformers_service.py"
    Start-Sleep -Seconds 2
    Write-Host "[2/4] Opening ranking_service (POST /rank for Train, port 5055) …" -ForegroundColor Green
    Start-ServiceWindow -Title "LLM-RANKER: ranking_service (5055)" -WorkingDirectory $PythonDir `
        -Arguments "python ranking_service.py"
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/4]-[2/4] Skipping Python services (-SkipPython)" -ForegroundColor Yellow
}

Write-Host "[3/4] Opening Node API …" -ForegroundColor Green
Start-ServiceWindow -Title "LLM-RANKER: Node API" -WorkingDirectory $ServerDir `
    -Arguments "node index.js"
Start-Sleep -Seconds 1

Write-Host "[4/4] Opening Vite client …" -ForegroundColor Green
Start-ServiceWindow -Title "LLM-RANKER: Vite" -WorkingDirectory $ClientDir `
    -Arguments "npm run dev"

Write-Host ""
Write-Host "Started. Checks:" -ForegroundColor Cyan
Write-Host "  Ranker (DB)   http://127.0.0.1:5056/health"
Write-Host "  Rank (Train)  http://127.0.0.1:5055/health"
Write-Host "  API           http://127.0.0.1:5000/health"
Write-Host "  Open the Local URL printed in the Vite window (often http://localhost:5173)."
Write-Host ""
Write-Host "First run may download Hugging Face model weights (both Python windows)." -ForegroundColor DarkGray
Write-Host "Stop servers by closing those windows." -ForegroundColor DarkGray
