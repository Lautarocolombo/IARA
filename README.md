# IARA - Artesanía Gualeguay

Sitio web de artesanías con panel de administración integrado.

## Stack

- **Frontend:** HTML5, CSS3, JavaScript vanilla (Vite 6)
- **Backend:** Node.js, Express 4
- **Base de datos:** PostgreSQL (Neon)
- **Storage:** Base64 en DB + Vercel Blob (opcional)
- **Colas:** BullMQ + Redis
- **Deploy:** Vercel (frontend), Render (backend)

## Estructura del proyecto

```
/
├── frontend/
│   ├── assets/
│   ├── css/
│   │   └── animations.css
│   ├── js/
│   │   ├── config.js
│   │   ├── products.js
│   │   ├── cart.js
│   │   ├── checkout.js
│   │   ├── admin-products.js
│   │   └── ...
│   ├── pages/
│   │   ├── index.html
│   │   ├── product.html
│   │   ├── cart.html
│   │   └── ...
│   └── index.html
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── lib/
│   │   └── queues/
│   ├── uploads/
│   ├── migrations/
│   ├── package.json
│   └── .env.example
│
├── tests/
│   ├── unit/
│   └── e2e/
│
├── .github/workflows/
├── vercel.json
├── render.yaml
├── package.json
└── README.md
```

## Desarrollo local

```bash
# Instalar dependencias
npm install
cd backend && npm install

# Iniciar backend
cd backend/src && node server.js

# Abrir navegador
http://localhost:3000
```

## Scripts disponibles

### Root
```bash
npm test              # Tests unitarios frontend (Jest + jsdom)
npm run lint          # ESLint frontend
npm run e2e           # Playwright E2E
npm run build         # Vite build (output: dist/)
```

### Backend
```bash
cd backend
npm test              # Tests unitarios backend (Jest)
npm run lint          # ESLint backend
npm run migrate       # Ejecutar migraciones
npm run backup        # Backup de base de datos
npm start             # Iniciar servidor
```

## Testing

| Suite | Comando | Tests |
|-------|---------|-------|
| Frontend unit | `npm test` | 326 specs |
| Backend unit | `cd backend && npm test` | 427 specs |
| E2E | `npm run e2e` | 12 specs |

## Despliegue

### URLs
- **Frontend (Vercel):** `https://artesania-gualeguay-v3.vercel.app`
- **Backend (Render):** `https://iara-os3h.onrender.com`

### Variables de entorno en Vercel

Configurar en **Vercel Dashboard > Settings > Environment Variables**:

| Variable | Valor | Requerido |
|----------|-------|-----------|
| `NODE_ENV` | `production` | Sí |
| `JWT_SECRET` | string seguro aleatorio | Sí |
| `ADMIN_USER` | tu usuario admin | Sí |
| `ADMIN_PASS_HASH` | hash bcrypt de tu contraseña | Sí |
| `ALLOWED_ORIGINS` | `https://artesania-gualeguay-v3.vercel.app,http://localhost:3000,http://localhost:5173` | Sí |
| `DATABASE_URL` | connection string de PostgreSQL | Sí |
| `SITE_URL` | `https://artesania-gualeguay-v3.vercel.app` | Sí |
| `BACKEND_URL` | `https://iara-os3h.onrender.com` | Sí |
| `RESEND_API_KEY` | API key de Resend | No |
| `EMAIL_FROM` | `noreply@artesaniagualeguay.com` | No |
| `ADMIN_NOTIFICATION_EMAIL` | `admin@artesaniagualeguay.com` | No |
| `WHATSAPP` | `+5493444634444` | No |
| `BLOB_READ_WRITE_TOKEN` | token de Vercel Blob | Sí (en producción) |

> Importante: No subas `backend/.env` a Git. Usá `vercel env add` o el Dashboard.

### Variables de entorno en Render

Configurar en **Render Dashboard > Environment**:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | connection string de PostgreSQL |
| `JWT_SECRET` | mismo que Vercel |
| `ADMIN_USER` | mismo que Vercel |
| `ADMIN_PASS_HASH` | mismo que Vercel |
| `ALLOWED_ORIGINS` | `https://artesania-gualeguay-v3.vercel.app,https://artesania-gualeguay.vercel.app,http://localhost:3000,http://localhost:5173` |
| `SITE_URL` | `https://artesania-gualeguay-v3.vercel.app` |
| `BACKEND_URL` | `https://iara-os3h.onrender.com` |
| `BLOB_READ_WRITE_TOKEN` | Obligatorio en producción (Render). Crear un Vercel Blob Store y pegar el token read+write. |

## Analytics

Para habilitar el seguimiento, completar los placeholders en `frontend/js/config.js`:

| Placeholder | Descripción | Cómo obtenerlo |
|-------------|-------------|----------------|
| `ANALYTICS.GOOGLE_ID` | ID de Google Analytics | Google Analytics > Admin > Data Streams |
| `ANALYTICS.FACEBOOK_PIXEL_ID` | ID del Meta Pixel | Meta Events Manager > Data Sources |
| `REVIEWS.GOOGLE_PLACE_ID` | ID del lugar de Google Maps | Google Maps > compartir > copiar Place ID |
| `REVIEWS.GOOGLE_WRITE_REVIEW_URL` | URL para escribir reseña | [Google Review URL generator](https://developers.google.com/maps/documentation/urls/get-api-key) |

## Almacenamiento de imágenes

Las imágenes se guardan en **Vercel Blob** cuando `BLOB_READ_WRITE_TOKEN` está configurado con un token válido.

En desarrollo sin Blob, las imágenes se guardan temporalmente en el filesystem local (`backend/uploads/imagenes`). En producción (Render), **no uses almacenamiento local**: el filesystem es efímero y las imágenes se pierden en cada redeploy. Si el token de Blob es inválido, la subida falla con un error explícito en vez de guardar localmente.

Para migrar imágenes existentes que estén en rutas locales rotas, ejecutá `backend/src/scripts/migrateImages.js` después de configurar Blob (si los archivos originales still existen).

## Seguridad

- Helmet (HSTS, CSP, COEP configurado)
- CSRF tokens en formularios
- XSS sanitización (DOMPurify + middleware)
- Rate limiting por IP
- JWT + bcrypt para auth
- Validación con Zod en rutas críticas
- CORS restrictivo
- Nonce para scripts inline
- Token blacklist (Redis)
- Audit log de acciones admin
- Sentry para monitoreo de errores (opcional)

## Rendimiento

- Compression gzip/brotli en respuestas
- Cache headers con ETag y Last-Modified en assets estáticos
- Imágenes optimizadas con Sharp (webp)
- Lazy loading en imágenes de producto
- Vercel Blob para CDN de imágenes (opcional)

## CI/CD

GitHub Actions workflows incluidos:
- `ci.yml` — pipeline principal
- `deploy.yml` — deploy automático
- `lint.yml` — lint en PRs
- `frontend-checks.yml` — tests + lint frontend
- `backend-tests.yml` — tests backend

## Mejoras implementadas

- Búsqueda y filtrado avanzado de productos
- Catálogo con categorías y precios
- Carrito de compras persistente
- Checkout con validación de envío
- Pagos por transferencia con comprobantes
- Panel de administración completo (roles admin/editor)
- Sistema de cupones de descuento
- Gestión de testimonios y reseñas
- Reportes de ventas y ganancias
- Gestión de envíos por provincia
- SEO: canonical URLs, sitemap, structured data
- SSE sync entre pestañas
- WhatsApp integration
- Cookie consent + políticas legales
