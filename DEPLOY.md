# IARA - Guía de Deploy

## Estado actual
- **Frontend:** Vercel (`https://iara-lovat-orcin.vercel.app`)
- **Backend:** Render (`https://iara-uxcu.onrender.com`)
- **Base de datos:** PostgreSQL en Render (auto-provisionada)

## Checklist de deploy

### 1. Backend (Render)

#### Variables de entorno en Render Dashboard → Settings → Environment
| Variable | Valor | Notas |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `JWT_SECRET` | string seguro aleatorio | Generar con: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ADMIN_USER` | `Iara` | |
| `ADMIN_PASS_HASH` | hash bcrypt | Generar con: `node -e "const bcrypt=require('bcrypt'); bcrypt.hash('pulseras2026',10).then(h=>console.log(h))"` |
| `DATABASE_URL` | connection string de Neon | Render lo genera automáticamente |
| `ALLOWED_ORIGINS` | `https://iara-lovat-orcin.vercel.app,https://*.vercel.app,https://artesaniagualeguay.com,http://localhost:3000` | |
| `SITE_URL` | `https://iara-lovat-orcin.vercel.app` | |
| `BACKEND_URL` | `https://iara-uxcu.onrender.com` | |
| `EMAIL_FROM` | `noreply@artesaniagualeguay.com` | |
| `ADMIN_NOTIFICATION_EMAIL` | `admin@artesaniagualeguay.com` | |
| `RESEND_API_KEY` | `re_...` | Opcional, para envío de emails |
| `CLOUDINARY_CLOUD_NAME` | tu-cloud-name | **Requerido para persistencia de imágenes** |
| `CLOUDINARY_API_KEY` | tu-api-key | |
| `CLOUDINARY_API_SECRET` | tu-api-secret | |
| `PORT` | `3000` | Render lo asigna automáticamente |
| `LOG_LEVEL` | `info` | |
| `SHIPPING_COST` | `200` | |
| `SHIPPING_THRESHOLD` | `2000` | |
| `WHATSAPP` | `+5493444634444` | |

#### Configuración de build/start en Render
- **Root Directory:** `backend`
- **Build Command:** `npm install --legacy-peer-deps`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`

#### CORS
El backend usa `ALLOWED_ORIGINS` con `credentials: true`. Asegurate de que el dominio de Vercel esté en la lista.

### 2. Frontend (Vercel)

#### Configuración en Vercel Dashboard → Settings → General
- **Framework Preset:** Other
- **Build Command:** `echo 'Build complete'` (no-op, frontend es HTML/JS estático)
- **Output Directory:** `frontend`
- **Install Command:** `npm install`

#### Variables de entorno en Vercel Dashboard → Settings → Environment Variables
| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |

> Nota: El frontend usa rutas relativas (`/api/*`, `/uploads/*`) que Vercel rewritea al backend en Render. No necesita URLs hardcodeadas.

#### Rewrites (vercel.json)
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://iara-uxcu.onrender.com/api/$1" },
    { "source": "/uploads/(.*)", "destination": "https://iara-uxcu.onrender.com/uploads/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 3. Dominios

- **Vercel:** `https://iara-lovat-orcin.vercel.app`
- **Render:** `https://iara-uxcu.onrender.com`

Si cambiás el dominio de Render, actualizá:
1. `vercel.json` (rewrites)
2. `render.yaml` (`BACKEND_URL` y `SITE_URL`)
3. Variables `BACKEND_URL` y `SITE_URL` en Render Dashboard

### 4. Post-deploy

1. Verificar health check: `curl https://iara-uxcu.onrender.com/health`
2. Verificar frontend: `https://iara-lovat-orcin.vercel.app`
3. Verificar API desde frontend: abrir consola del navegador y verificar que `/api/health` responda 200
4. Verificar login en admin: `https://iara-lovat-orcin.vercel.app/pages/admin.html`
5. Subir una imagen de producto y verificar que persista (requiere Cloudinary configurado)

### 5. Notas importantes

- **Imágenes:** Sin Cloudinary, las imágenes subidas desde el admin se pierden en cada deploy de Render porque usa filesystem efímero.
- **Emails:** Sin `RESEND_API_KEY`, los envíos de email fallan silenciosamente.
- **Base de datos:** Las migraciones corren automáticamente en `initDB()` al arrancar el backend.
- **Tests e2e:** Corren contra archivos locales (`file://`). Para correr: `npm run e2e`

## Troubleshooting

### Error 401 en admin
- Verificar que `JWT_SECRET` esté configurado en Render
- Verificar que `ALLOWED_ORIGINS` incluya el dominio de Vercel

### Imágenes no se muestran
- Verificar que `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` estén en Render
- Verificar que `BACKEND_URL` esté correcto en Render

### CORS errors
- Verificar `ALLOWED_ORIGINS` en Render incluye el dominio exacto de Vercel
- No uses `*` en producción si hay cookies/autenticación

### Build falla en Render
- Verificar que `rootDirectory` sea `backend`
- Verificar que el build command sea `npm install --legacy-peer-deps`
- Verificar que no haya variables faltantes (el backend hace `process.exit(1)` si faltan)
