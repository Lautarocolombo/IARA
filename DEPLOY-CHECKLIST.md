# Production Deploy Checklist - Artesanía Gualeguay Carrusel Fix

## ✅ Código listo (verificado localmente)

### Frontend
- [x] `frontend/js/about-carousel.js` - fallback robusto con flag `data-fallback-tried`
- [x] `frontend/css/components.css` - aspect-ratio 16/9 (4/3 móvil), object-fit: cover
- [x] `frontend/index.html` - tabindex, role, aria-label en wrapper
- [x] Navegación teclado (ArrowLeft/ArrowRight)
- [x] Build exitoso (`npm run build`) - 552 tests pass
- [x] Lint limpio (`npm run lint`)

### Backend
- [x] `backend/src/lib/upload.js:getPublicUrl` - usa `FRONTEND_URL` para `/imagenes/*`
- [x] `backend/src/lib/upload.js:processFile` - lanza 503 si Blob no configurado (no fallback base64)
- [x] `backend/src/controllers/carouselController.js` - catch errores `BLOB_NOT_CONFIGURED`/`BLOB_UPLOAD_FAILED`
- [x] Tests 520 pass, lint limpio

---

## 🔧 Configuración pendiente en Render Dashboard

| Variable | Valor | Dónde obtener |
|----------|-------|---------------|
| `FRONTEND_URL` | `https://artesania-gualeguay-v3.vercel.app` | **Obligatorio** - Vercel project settings |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_xxx` o `vcp_xxx` | **Obligatorio** - Vercel Dashboard → Stores → [store] → Settings → Read/Write Token |
| `DATABASE_URL` | `postgresql://...` | **Obligatorio** - Neon Dashboard → Connection Details |
| `ADMIN_PASS_HASH` | `$2b$10$...` | **Obligatorio** - `node -e "console.log(require('bcryptjs').hashSync('tu-pass', 10))"` |
| `CSRF_SECRET` | (auto-generado si vacío) | Opcional - `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## 🚀 Deploy (ejecutar en terminal local con git)

```bash
cd "H:\VScode\Proyectos\Nueva carpeta"
git add -A
git commit -m "fix: carousel images - getPublicUrl usa FRONTEND_URL para /imagenes/*, fallback robusto, upload 503 sin base64, CSS aspect-ratio 16/9, teclado a11y"
git push origin main
```

**Auto-deploy:**
- Frontend → Vercel (GitHub Actions `.github/workflows/deploy.yml`)
- Backend → Render (autoDeploy: true en `render.yaml`)

---

## ✅ Verificación post-deploy

```bash
# 1. Backend API devuelve URLs de Vercel (no del backend)
curl https://iara-os3h.onrender.com/api/carousel/public
# Esperado: "url": "https://artesania-gualeguay-v3.vercel.app/imagenes/carrucel/1.jpg"

# 2. Health check confirma Blob configurado
curl https://iara-os3h.onrender.com/health
# Esperado: "blob": {"configured": true}

# 3. Imágenes cargan desde Vercel (200 image/jpeg)
curl -I https://artesania-gualeguay-v3.vercel.app/imagenes/carrucel/1.jpg

# 4. Frontend: abrir https://artesania-gualeguay-v3.vercel.app/ → sección "Sobre Nosotros"
# Debe verse carrusel con 5 imágenes, sin placeholders rosa
```

---

## 📸 Migración imágenes a Vercel Blob (tras configurar token)

```bash
# En Render Shell (o local con DATABASE_URL de producción)
cd backend
DRY_RUN=true node src/scripts/migrate-all-images-to-blob.js
# Revisar output, luego:
DRY_RUN=false node src/scripts/migrate-all-images-to-blob.js
```

**Imágenes a migrar (5 slots):**
- `/imagenes/carrucel/1.jpg` (191KB)
- `/imagenes/carrucel/2.jpg` (73KB)  
- `/imagenes/carrucel/3.jpg` (89KB)
- `/imagenes/carrucel/4.jpg` (164KB)
- `/imagenes/carrucel/5.jpg` (111KB)

---

## 🧪 Test admin upload (tras deploy)

1. Login admin → Sección "Carrusel"
2. Slot 1: "Cambiar imagen" → seleccionar archivo → "Guardar cambios"
3. Verificar toast "✅ Imagen del slot 1 guardada"
4. Recargar frontend público → imagen actualizada sin recargar caché manual

---

## ⚠️ Riesgos

| Riesgo | Mitigación |
|--------|------------|
| `FRONTEND_URL` no seteado en Render | Backend devuelve paths relativos `/imagenes/...` que funcionan igual |
| Token Blob inválido | Upload devuelve 503 claro: "No se pudo subir: almacenamiento no configurado" |
| Caché Vercel | Assets estáticos tienen `Cache-Control: public, max-age=31536000, immutable` |
| DB Neon no accesible | Health check falla → Render reinicia automáticamente |

---

## 📁 Archivos modificados (git diff --stat)

```
 frontend/js/about-carousel.js          |  28 ++-
 frontend/css/components.css            | 112 ++++---
 frontend/index.html                    |   2 +-
 backend/src/lib/upload.js              |  64 ++---
 backend/src/controllers/carouselController.js |  12 ++
 backend/.env                           |   1 +
 backend/.env.example                   |   3 +
 render.yaml                            |   1 +
 backend/tests/blobUpload.test.js       |  84 ++++---
 9 files changed, 207 insertions(+), 100 deletions(-)
```

**Comando revertir:**
```bash
git checkout HEAD -- frontend/js/about-carousel.js frontend/css/components.css frontend/index.html backend/src/lib/upload.js backend/src/controllers/carouselController.js backend/.env backend/.env.example render.yaml backend/tests/blobUpload.test.js
```