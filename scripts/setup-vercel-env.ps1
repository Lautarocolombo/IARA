# Configurar variables de entorno en Vercel
# Requiere Vercel CLI instalado y autenticado (vercel login)

$ErrorActionPreference = 'Stop'

# Verificar que vercel CLI esté disponible
$vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelCmd) {
  Write-Host "ERROR: Vercel CLI no encontrado. Instalalo con: npm i -g vercel" -ForegroundColor Red
  exit 1
}

# Variables requeridas - completar con valores reales antes de ejecutar
$envVars = @{
  'NODE_ENV' = 'production'
  'JWT_SECRET' = ''
  'ADMIN_USER' = 'admin'
  'ADMIN_PASS_HASH' = ''
  'ALLOWED_ORIGINS' = 'https://iara-ivory.vercel.app,http://localhost:3000,http://localhost:5173'
  'DATABASE_URL' = ''
  'SITE_URL' = 'https://iara-ivory.vercel.app'
  'RESEND_API_KEY' = ''
  'EMAIL_FROM' = 'noreply@artesaniagualeguay.com'
  'ADMIN_NOTIFICATION_EMAIL' = 'admin@artesaniagualeguay.com'
}

foreach ($key in $envVars.Keys) {
  $value = $envVars[$key]
  if ([string]::IsNullOrEmpty($value)) {
    $value = Read-Host "Ingresa el valor para $key"
  }
  if ([string]::IsNullOrEmpty($value)) {
    Write-Host "Saltando $key (valor vacio)" -ForegroundColor Yellow
    continue
  }
  Write-Host "Agregando $key ..."
  echo $value | vercel env add $key production | Out-Null
  echo $value | vercel env add $key preview | Out-Null
}

Write-Host "`nVariables configuradas. Verificá en Vercel Dashboard > Settings > Environment Variables." -ForegroundColor Green
