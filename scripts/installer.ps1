$ErrorActionPreference = "Stop"
$appName = "Sebastian G • Estudio POS"
$exeName = "SebastianG.exe"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = Join-Path $scriptDir "..\release\SebastianG-win32-x64"
if (-not (Test-Path $sourceDir)) {
    $sourceDir = $scriptDir
}

$installDir = Join-Path $env:LOCALAPPDATA "Programs\SebastianG"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     SEBASTIAN G • SOFTWARE DE ESCRITORIO POS ESTUDIO     " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Instalando en: $installDir ..." -ForegroundColor Gray

if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Copiar archivos binarios
Copy-Item -Path "$sourceDir\*" -Destination $installDir -Recurse -Force
Write-Host "[OK] Archivos del programa copiados correctamente." -ForegroundColor Green

# Crear acceso directo en el Escritorio
$desktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$shortcutPath = Join-Path $desktopPath "$appName.lnk"
$iconPath = Join-Path $installDir "resources\app\public\app-icon.ico"
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $installDir $exeName
}

$wscript = New-Object -ComObject WScript.Shell
$shortcut = $wscript.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $installDir $exeName
$shortcut.WorkingDirectory = $installDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "Sistema de Gestión y POS Sebastian G"
$shortcut.Save()
Write-Host "[OK] Acceso directo en el Escritorio creado con éxito." -ForegroundColor Green

# Crear acceso directo en el Menú Inicio de Windows
$startMenuPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
$startShortcutPath = Join-Path $startMenuPath "$appName.lnk"
$startShortcut = $wscript.CreateShortcut($startShortcutPath)
$startShortcut.TargetPath = Join-Path $installDir $exeName
$startShortcut.WorkingDirectory = $installDir
$startShortcut.IconLocation = "$iconPath,0"
$startShortcut.Description = "Sistema de Gestión y POS Sebastian G"
$startShortcut.Save()
Write-Host "[OK] Acceso directo en el Menú Inicio creado con éxito." -ForegroundColor Green

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ¡INSTALACIÓN COMPLETADA! Abriendo Sebastian G...        " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Start-Process -FilePath (Join-Path $installDir $exeName)
