# MATRIZ DE VARIABLES DE ENTORNO - IARA e-Commerce

## Vercel (Frontend)

| Variable | Descripción | Valor | Requerida |
|----------|-------------|-------|-----------|
| No requiere variables adicionales | El frontend consume la API via proxy | - | No |

**Nota:** Las variables del backend se acceden via proxy en `/api/*`.

## Render (Backend)

| Variable | Descripción | Valor de Ejemplo | Requerida |
|----------|-------------|-----------------|-----------|
| `NODE_ENV` | Entorno de ejecución | `production` | Sí |
| `PORT` | Puerto interno | `3000` | Sí |
| `JWT_SECRET` | Secreto para firmar JWT | `crypto.randomBytes(64).toString('hex')` | Sí |
| `CSRF_SECRET` | Secreto para tokens CSRF | `crypto.randomBytes(32).toString('hex')` | Sí |
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@host:5432/db?sslmode=require` | Sí |
| `ALLOWED_ORIGINS` | Orígenes permitidos para CORS | `https://iara-lovat.vercel.app,https://*.vercel.app` | Sí |
| `SITE_URL` | URL base del sitio (usado en sitemap) | `https://iara-lovat.vercel.app` | Sí |
| `ADMIN_USER` | Usuario administrador | `Iara` | Sí |
| `ADMIN_PASS_HASH` | Hash bcrypt de contraseña admin | `$2b$10$...` | Sí |
| `RESEND_API_KEY` | API key para envío de emails | `re_...` | No |
| `EMAIL_FROM` | Remitente de emails | `noreply@artesaniagualeguay.com` | No |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob para almacenamiento de imágenes | `vercel_blob_...` | No |
| `LOG_LEVEL` | Nivel de logging | `info` | No |
| `BUSINESS_NAME` | Nombre del negocio | `Artesanía Gualeguay` | No |
| `BUSINESS_EMAIL` | Email de contacto | `contacto@artesaniagualeguay.com` | No |

## Variables Eliminadas (Por Seguridad)

| Variable Eliminada | Razón | Reemplazo |
|-------------------|--------|-----------|
| `ADMIN_PASS` | Contraseña en texto plano | `ADMIN_PASS_HASH` (bcrypt) |
| `ADMIN_PASS_HASH` en `.env.example` | Credenciales en repo | Generar localmente |

## Comandos de Configuración

```bash
# 1. Generar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 2. Generar CSRF_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Generar ADMIN_PASS_HASH (bcrypt)
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('pulseras2026', 10).then(h => console.log(h))"

# 4. Configurar en Render
# Ir a https://dashboard.render.com → iara-backend → Settings → Environment
```

## Validación de Variables al Startup

El servidor valida las siguientes variables al arrancar y falla si faltan:
- `JWT_SECRET`
- `ADMIN_USER`
- `ADMIN_PASS_HASH`
- `DATABASE_URL` (solo producción)
- `ALLOWED_ORIGINS` (solo producción)
