# Deployment - Módulo de Gestión de Imágenes

## Variables de entorno requeridas

### Backend (Render)

```env
# Obligatorias
NODE_ENV=production
JWT_SECRET=<generar con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
ADMIN_USER=<usuario admin>
ADMIN_PASS_HASH=<hash bcrypt de contraseña>

# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# CORS
ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com

# URLs
BACKEND_URL=https://tu-backend.onrender.com
SITE_URL=https://tudominio.com

# Opcional: Vercel Blob para almacenamiento de imágenes (alternativa a base64)
BLOB_READ_WRITE_TOKEN=<token de Vercel Blob>

# Redis / BullMQ (recomendado para colas)
REDIS_URL=rediss://default:gQAAAAAAAjJ0AAIgcDIyZDg4NGEwNjVkY2I0YmZkODlmMWRhY2E3YWY4NmU3Zg@witty-troll-143988.upstash.io:6379


# SMTP (opcional - para envío de comprobantes por email)
SMTP_HOST=smtp.tu-servidor.com
SMTP_PORT=587
SMTP_USER=tu-usuario@tu-servidor.com
SMTP_PASS=tu-contraseña
SMTP_FROM=Artesania Gualeguay <pedidos@artesaniagualeguay.com>
```

### Frontend (Vercel)

```env
VITE_API_BASE=https://tu-backend.onrender.com
```

## CI/CD

### GitHub Actions

El repositorio incluye workflows automáticos en `.github/workflows/`:

- **backend-tests.yml**: Corre tests y lint del backend en cada PR
- **frontend-checks.yml**: Valida HTML y JS del frontend en cada PR
- **lint.yml**: Lint del backend en cada push

Los workflows se ejecutan automáticamente cuando:
- Haces push a `main` o `master`
- Creas o actualizas un Pull Request hacia `main` o `master`

## Configuración paso a paso

### 1. Almacenamiento de imágenes

**Importante:** En producción (Render) el filesystem es efímero. Configurá Vercel Blob para que las imágenes persistan.

1. Crear cuenta en https://vercel.com
2. Crear un Blob Store
3. Obtener `BLOB_READ_WRITE_TOKEN` (read+write)
4. Configurar en Render como variable de entorno

El módulo usará Vercel Blob automáticamente si está configurado. En producción, si el token es inválido, la subida falla con un error explícito para evitar perder imágenes en `/tmp`.

### 2. Redis + BullMQ (Colas asíncronas) — Upstash Redis

**Upstash Redis** es el servicio recomendado para Render (plan gratuito: 10k comandos/día).

Pasos:
1. Crear cuenta en https://upstash.com
2. Crear una nueva instancia de Redis
3. Obtener la URL de conexión (formato: `redis://default:password@tu-redis.upstash.io:6379`)
4. Configurar `REDIS_URL` en Render con esa URL

El worker se inicia automáticamente al arrancar el servidor. Si Redis no está disponible, el sistema continúa funcionando en modo síncrono (fallback).

### 4. SMTP (Opcional - Emails)

1. Configurar servicio SMTP (Gmail, SendGrid, Mailgun, etc.)
2. Para Gmail: usar "Contraseña de aplicación"
3. Configurar variables `SMTP_*` en Render
4. El sistema enviará comprobantes por email automáticamente

### 5. Backup automático (Cron Job en Render)

El script `src/scripts/backup.js` genera backups de PostgreSQL.

**En Render**: Crear un Cron Job con:
- **Comando**: `node src/scripts/backup.js`
- **Frecuencia**: Diaria (ej: `0 3 * * *` — 3 AM)
- **Plan**: Free (ejecuta una vez al día)

Los backups se guardan en `/backups/` con retención de 7 días.

### 6. Deploy Backend (Render)

1. Conectar repo de GitHub a Render
2. Crear nuevo Web Service
3. Configurar:
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Plan**: Free o Starter
4. Agregar todas las variables de entorno listadas arriba
5. Deploy

### 7. Deploy Frontend (Vercel)

1. Conectar repo a Vercel
2. Framework preset: Vite
3. Configurar variable de entorno:
   - `VITE_API_BASE` = URL del backend en Render
4. Deploy

## Funcionamiento en producción

### Upload de imágenes
1. Admin sube imagen → Validación cliente + servidor
2. Si Vercel Blob está configurado con un token válido: upload a Blob (URL pública persistente)
3. Si el token es inválido o Blob no está disponible en producción: la subida falla con error 500 para evitar guardar en storage efímero
4. En desarrollo sin Blob: fallback a filesystem local (`backend/uploads/imagenes`)

### Variantes de imagen
- **Vercel Blob**: URLs públicas directas desde Vercel CDN
- **Local (solo dev)**: rutas `/uploads/imagenes/...` servidas por Express

### Watermark
- No disponible en modo base64
- Disponible con Vercel Blob si se configura

### Comprobantes (Receipts)
- Generación de PDF con PDFKit
- Envío por WhatsApp (link directo)
- Envío por email (SMTP)
- Tracking: `sent_whatsapp`, `sent_email` en BD

### Rate limiting
- Uploads: 20 por IP cada 15 minutos
- Login: 20 intentos cada 15 minutos
- API general: 100 requests por IP cada 15 minutos

## Monitoreo

- **Logs**: Pino estructurado en Render
- **Health check**: `GET /health`

## Escalabilidad

- **Imágenes**: base64 en PostgreSQL (Neon) o Vercel Blob
- **Backend**: Render escala vertical u horizontal según plan
- **Frontend**: Vercel CDN global

## Costos estimados (etapa inicial)

| Servicio | Plan | Costo |
|----------|------|-------|
| Render (backend) | Free | $0 |
| Vercel (frontend) | Free | $0 |
| Neon (PostgreSQL) | Free | $0 |
| Vercel Blob | Free tier | $0 |
| SMTP (Gmail/Resend) | Free tier | $0 |

**Total inicial: $0** (hasta ~1000 visitas/mes, 50-100 productos)
