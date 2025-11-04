param(
    [switch]$Force,
    [switch]$SkipInstall
)

$port = 3000

function Require-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Host ("[ERROR] Command '{0}' not found. {1}" -f $Name, $InstallHint) -ForegroundColor Red
        exit 1
    }

    $version = & $Name --version
    Write-Host ("[OK] {0} detected: {1}" -f $Name, $version) -ForegroundColor Green
}

function Ensure-Port-Free {
    param(
        [Parameter(Mandatory = $true)][int]$TargetPort,
        [switch]$Kill
    )

    $connections = Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue

    if (-not $connections) {
        return
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    $procDetails = $pids | ForEach-Object {
        try {
            Get-Process -Id $_ -ErrorAction Stop | Select-Object Id, ProcessName
        } catch {
            [PSCustomObject]@{ Id = $_; ProcessName = "<unknown>" }
        }
    }

    Write-Host ("[!] Port {0} is already in use:" -f $TargetPort) -ForegroundColor Yellow
    $procDetails | ForEach-Object {
        Write-Host ("    PID={0}  Name={1}" -f $_.Id, $_.ProcessName) -ForegroundColor Yellow
    }

    if (-not $Kill) {
        Write-Host "Terminate the listed processes or re-run the script with -Force." -ForegroundColor Yellow
        exit 1
    }

    foreach ($pid in $pids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host ("[OK] Process PID={0} stopped" -f $pid) -ForegroundColor Green
        } catch {
            Write-Host ("[ERROR] Failed to stop process PID={0}: {1}" -f $pid, $_.Exception.Message) -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Launching DezTehUg on http://localhost:$port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Require-Command -Name "node" -InstallHint "Please install Node.js from https://nodejs.org"
Require-Command -Name "npm" -InstallHint "Please install Node.js (with npm) from https://nodejs.org"

Ensure-Port-Free -TargetPort $port -Kill:$Force

if (-not $SkipInstall) {
    Write-Host "[1/3] Checking dependencies..." -ForegroundColor Yellow
    if (-not (Test-Path "node_modules")) {
        Write-Host "[2/3] Installing dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] npm install failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "[OK] Dependencies already installed" -ForegroundColor Green
    }
} else {
    Write-Host "[!] Skipping dependency check (--SkipInstall)" -ForegroundColor Yellow
}

$env:PORT = $port

Write-Host "[3/3] Starting Next.js dev server on http://localhost:$port" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Server is starting..." -ForegroundColor Cyan
Write-Host ("  Open browser: http://localhost:{0}" -f $port) -ForegroundColor Cyan
Write-Host "  Stop with Ctrl+C" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    npm run dev -- --port $port
} finally {
    Start-Sleep -Milliseconds 200
    Remove-Item Env:PORT -ErrorAction SilentlyContinue | Out-Null
}

