# Script: Rotar VERCEL_OIDC_TOKEN
# Uso: .\scripts\rotate-vercel-token.ps1
# Requiere: Vercel CLI instalado y logueado (vercel login)

param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Write-Header($text) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Step($text) {
    Write-Host "[PASO] $text" -ForegroundColor Yellow
}

function Write-Ok($text) {
    Write-Host "[OK] $text" -ForegroundColor Green
}

function Write-Err($text) {
    Write-Host "[ERROR] $text" -ForegroundColor Red
}

Write-Header "Rotación de VERCEL_OIDC_TOKEN"

# Verificar que vercel CLI está instalado
Write-Step "Verificando Vercel CLI..."
$vercelVersion = vercel --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Vercel CLI no está instalado. Ejecutá: npm install -g vercel"
    exit 1
}
Write-Ok "Vercel CLI detectado: $vercelVersion"

# Verificar login
Write-Step "Verificando sesión de Vercel..."
$whoami = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "No estás logueado en Vercel. Ejecutá: vercel login"
    exit 1
}
Write-Ok "Sesión activa como: $whoami"

# Listar tokens actuales
Write-Step "Tokens actuales en tu cuenta:"
$tokens = vercel tokens list 2>&1 | Out-String
Write-Host $tokens

# Verificar si el token expuesto está en la lista
if ($tokens -match "VERCEL_OIDC_TOKEN|eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im1yay") {
    Write-Warning "Se detectó el token expuesto en tu lista de tokens"
    if (-not $Force) {
        $confirm = Read-Host "¿Deseas continuar con la rotación? (s/N)"
        if ($confirm -ne "s" -and $confirm -ne "S") {
            Write-Host "Cancelado por el usuario."
            exit 0
        }
    }
}

# Revocar token expuesto si existe
Write-Step "Revocando token expuesto (si existe)..."
$revokeOutput = vercel tokens revoke VERCEL_OIDC_TOKEN 2>&1 | Out-String
if ($LASTEXITCODE -eq 0) {
    Write-Ok "Token revocado exitosamente"
} else {
    Write-Host "Nota: $revokeOutput"
}

# Generar nuevo token
Write-Step "Generando nuevo token..."
$newToken = vercel tokens create iara-rotate-$(Get-Date -Format 'yyyyMMdd-HHmmss') --scope "deploy" 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Err "Error generando token: $newToken"
    exit 1
}

# Extraer el token de la salida (formato: "Token: <token>" o similar)
if ($newToken -match "([a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)") {
    $tokenValue = $matches[1]
    Write-Ok "Nuevo token generado (primeros 20 chars): $($tokenValue.Substring(0, [Math]::Min(20, $tokenValue.Length)))..."
} else {
    Write-Host "Token generado. Revisá la salida arriba para copiarlo manualmente."
    $tokenValue = Read-Host "Pegá el nuevo token completo"
}

# Actualizar GitHub Secret
Write-Step "Actualizando secret VERCEL_TOKEN en GitHub..."
if (-not $tokenValue) {
    Write-Err "No se pudo extraer el token. Por favor, actualizalo manualmente en GitHub Secrets."
    exit 1
}

# Usar GitHub CLI si está disponible
$ghVersion = gh --version 2>&1
if ($LASTEXITCODE -eq 0) {
    $repo = git remote get-url origin 2>&1 | Out-String
    if ($repo -match "github\.com[:/]([^/]+)/([^/.]+)") {
        $owner = $matches[1]
        $repoName = $matches[2]
        Write-Host "Actualizando secret en $owner/$repoName..."
        gh secret set VERCEL_TOKEN -b $tokenValue --repo $owner/$repoName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "GitHub secret actualizado exitosamente"
        } else {
            Write-Warning "No se pudo actualizar automáticamente. Hacelo manualmente en: https://github.com/$owner/$repoName/settings/secrets/actions"
        }
    } else {
        Write-Warning "No se detectó un repositorio GitHub. Actualizá el secret manualmente."
    }
} else {
    Write-Warning "GitHub CLI no detectado. Actualizá el secret manualmente en: https://github.com/settings/secrets/actions"
}

# Actualizar .vercel/.env.production.local (sin el token, solo metadatos)
Write-Step "Actualizando archivos locales de Vercel..."
$envDir = ".vercel"
if (-not (Test-Path $envDir)) {
    New-Item -ItemType Directory -Path $envDir | Out-Null
}
$envContent = @"
# Created by Vercel CLI
# IMPORTANTE: Los secrets van en Vercel Dashboard → Environment Variables.
# Este archivo NO debe commitearse.
NX_DAEMON="false"
TURBO_CACHE="remote:rw"
TURBO_DOWNLOAD_LOCAL_ENABLED="true"
TURBO_REMOTE_ONLY="true"
TURBO_RUN_SUMMARY="true"
VERCEL="1"
VERCEL_ENV="production"
VERCEL_URL=""
"@
Set-Content -Path "$envDir/.env.production.local" -Value $envContent -Encoding UTF8
Write-Ok "Archivos locales actualizados (sin token sensible)"

Write-Header "Rotación completada"
Write-Host "Próximos pasos:"
Write-Host "  1. Verificar que el deploy en Vercel funcione correctamente"
Write-Host "  2. Ejecutar pipeline de CI/CD para validar"
Write-Host "  3. Si todo funciona, eliminar el token viejo de la lista de tokens en Vercel Dashboard"
Write-Host ""
