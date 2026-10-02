param(
    [string]$Dsn = "//localhost:1521/FREEPDB1",
    [string]$AdminUser = "SYSTEM",
    [switch]$OverwriteConnectionConfig
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $RootDir ".venv\Scripts\python.exe"
$PythonLauncher = $null
$PythonArgs = @()

foreach ($PythonInstall in (Get-ChildItem (Join-Path $env:LOCALAPPDATA "Programs\Python") -Directory -Filter "Python3*" -ErrorAction SilentlyContinue)) {
    $PythonCandidate = Join-Path $PythonInstall.FullName "python.exe"
    if (Test-Path $PythonCandidate) {
        try {
            $PythonVersion = (& $PythonCandidate --version 2>&1 | Out-String)
            if ($PythonVersion -match "Python 3\.\d+") {
                $PythonLauncher = $PythonCandidate
                break
            }
        }
        catch {
            continue
        }
    }
}

if (-not $PythonLauncher -and (Get-Command python -ErrorAction SilentlyContinue)) {
    try {
        $PythonVersion = (& python --version 2>&1 | Out-String)
        if ($PythonVersion -match "Python 3\.\d+") {
            $PythonLauncher = "python"
        }
    }
    catch {
        $PythonLauncher = $null
    }
}
if (-not $PythonLauncher -and (Get-Command py -ErrorAction SilentlyContinue)) {
    try {
        $PythonVersion = (& py -3 --version 2>&1 | Out-String)
        if ($PythonVersion -match "Python 3\.\d+") {
            $PythonLauncher = "py"
            $PythonArgs = @("-3")
        }
    }
    catch {
        $PythonLauncher = $null
    }
}
if (-not $PythonLauncher) {
    throw "Python 3 est requis. Installez Python depuis python.org, puis relancez ce script."
}

Push-Location $RootDir
try {
    if (-not (Test-Path $VenvPython)) {
        & $PythonLauncher @PythonArgs -m venv .venv
        if ($LASTEXITCODE -ne 0) {
            throw "Impossible de créer l'environnement Python. Vérifiez l'installation de Python 3."
        }
    }

    & $VenvPython -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        throw "L'installation des dépendances Python a échoué."
    }

    $BootstrapArgs = @(
        (Join-Path $RootDir "oracle\bootstrap_app_schema.py"),
        "--dsn", $Dsn,
        "--admin-user", $AdminUser
    )
    if ($OverwriteConnectionConfig) {
        $BootstrapArgs += "--overwrite-config"
    }

    & $VenvPython @BootstrapArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Le bootstrap Oracle a échoué. Vérifiez le service FREEPDB1, le DSN et les identifiants saisis."
    }
}
finally {
    Pop-Location
}