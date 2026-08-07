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

# Cloudinary (recomendado para producción)
CLOUDINARY_CLOUD_NAME=<tu cloud name>
CLOUDINARY_API_KEY=<tu api key>
CLOUDINARY_API_SECRET=<tu api secret>

# Redis / BullMQ (recomendado para colas)
REDIS_URL=rediss://default:gQAAAAAAAjJ0AAIgcDIyZDg4NGEwNjVkY2I0YmZkODlmMWRhY2E3YWY4NmU3Zg@witty-troll-143988.upstash.io:6379

# remove.bg (opcional - para remoción de fondo)
REMOVE_BG_API_KEY=<tu api key de remove.bg>

# SMTP (opcional - para envío de comprobantes por email)
SMTP_HOST=smtp.tu-servidor.com
SMTP_PORT=587
SMTP_USER=tu-usuario@tu-servidor.com
SMTP_PASS=tu-contraseña
SMTP_FROM=Artesania Gualeguay <pedidos@artesaniagualeguay.com>

# URLs
BACKEND_URL=https://tu-backend.onrender.com
SITE_URL=https://tudominio.com
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

### 1. Cloudinary

1. Crear cuenta en https://cloudinary.com (plan gratuito disponible)
2. Obtener `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
3. Configurar en Render como variables de entorno
4. El módulo usará Cloudinary automáticamente para:
   - Upload de imágenes
   - Variantes on-the-fly (thumbnail, catalog, zoom)
   - Watermark dinámico (sin regenerar archivos)
   - CDN y optimización automática

### 2. Redis + BullMQ (Colas asíncronas) — Upstash Redis

**Upstash Redis** es el servicio recomendado para Render (plan gratuito: 10k comandos/día).

Pasos:
1. Crear cuenta en https://upstash.com
2. Crear una nueva instancia de Redis
3. Obtener la URL de conexión (formato: `redis://default:password@tu-redis.upstash.io:6379`)
4. Configurar `REDIS_URL` en Render con esa URL

El worker se inicia automáticamente al arrancar el servidor. Si Redis no está disponible, el sistema continúa funcionando en modo síncrono (fallback).

### 3. remove.bg (Opcional)

1. Crear cuenta en https://www.remove.bg
2. Obtener API key
3. Configurar `REMOVE_BG_API_KEY` en Render
4. El botón "Remover fondo" aparecerá en el admin

**Sin API key**: el botón no aparecerá o mostrará error al intentar usarlo.

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
2. Si Cloudinary está configurado: upload directo a Cloudinary
3. Si no: almacenamiento local en `/tmp/uploads` (Render) o `uploads/` (Vercel)
4. Generación de variantes (si Redis disponible: encola; si no: síncrono)

### Variantes de imagen
- **Cloudinary**: on-the-fly via CDN (sin storage extra)
- **Local**: archivos estáticos en `/uploads/products/variants/`
- El frontend recibe `srcset` + `sizes` listos para usar

### Watermark
- **Cloudinary**: transform on-the-fly con `l_text` en la URL
- **Local**: Sharp genera archivo con watermark embebido
- Configurable por imagen: texto, opacidad (0-1), posición, tamaño (%)

### Background removal
- Procesado via API remove.bg
- Requiere `REMOVE_BG_API_KEY` configurada
- Resultado: PNG con fondo transparente

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
- **Colas**: BullMQ con Upstash Redis
- **Health check**: `GET /health`

## Escalabilidad

- **Imágenes**: Cloudinary maneja CDN y transformaciones
- **Colas**: Upstash Redis escala automáticamente
- **Backend**: Render escala vertical u horizontal según plan
- **Frontend**: Vercel CDN global

## Costos estimados (etapa inicial)

| Servicio | Plan | Costo |
|----------|------|-------|
| Render (backend) | Free | $0 |
| Vercel (frontend) | Free | $0 |
| Cloudinary | Free (25GB, 25GB bandwidth) | $0 |
| Upstash Redis | Free (10k commands/day) | $0 |
| remove.bg | Free (50 imágenes/mes) | $0 |
| SMTP (Gmail/Resend) | Free tier | $0 |

**Total inicial: $0** (hasta ~1000 visitas/mes, 50-100 productos)
