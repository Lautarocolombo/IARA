# IARA - Artesanía Gualeguay

Sitio web de artesanías con panel de administración integrado.

## Estructura del proyecto

```
/
├── frontend/
│   ├── assets/
│   ├── css/
│   │   └── animations.css
│   ├── js/
│   ├── pages/
│   └── index.html
│
├── backend/
│   ├── src/
│   │   └── server.js
│   ├── uploads/
│   ├── package.json
│   └── .env.example
│
├── tests/
│   ├── e2e/
│   └── unit/
│
├── .env.local
├── .gitignore
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



## Despliegue

- **Frontend (Vercel):** `https://artesaniagualeguay.vercel.app`
- **Backend (Render):** `https://iara-backend.onrender.com`

### Variables de entorno en Vercel

Configurar en **Vercel Dashboard > Settings > Environment Variables**:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | string seguro aleatorio |
| `ADMIN_USER` | tu usuario admin |
| `ADMIN_PASS_HASH` | hash bcrypt de tu contraseña admin (generar con `bcrypt.hash('contraseña', 10)`) |
| `ALLOWED_ORIGINS` | `https://artesaniagualeguay.vercel.app,http://localhost:3000,http://localhost:5173` |
| `DATABASE_URL` | connection string de PostgreSQL |
| `SITE_URL` | `https://artesaniagualeguay.vercel.app` |
| `BACKEND_URL` | `https://iara-backend.onrender.com` |
| `RESEND_API_KEY` | (opcional) |
| `EMAIL_FROM` | `noreply@artesaniagualeguay.com` |
| `ADMIN_NOTIFICATION_EMAIL` | `admin@artesaniagualeguay.com` |
| `WHATSAPP` | `+5493444634444` |

> Importante: No subas `backend/.env` a Git. Usá `vercel env add` o el Dashboard.

### Analytics

Para habilitar el seguimiento, completar los placeholders en `frontend/js/config.js`:

| Placeholder | Descripción | Cómo obtenerlo |
|-------------|-------------|----------------|
| `ANALYTICS.GOOGLE_ID` | ID de Google Analytics (ej: `G-XXXXXXXXXX`) | Google Analytics > Admin > Data Streams > tu stream |
| `ANALYTICS.FACEBOOK_PIXEL_ID` | ID del Meta Pixel (ej: `123456789`) | Meta Events Manager > Data Sources |
| `REVIEWS.GOOGLE_PLACE_ID` | ID del lugar de Google Maps para reseñas | Google Maps > compartir > "Abrir en Maps" > copiar el Place ID |
| `REVIEWS.GOOGLE_WRITE_REVIEW_URL` | URL directa para escribir reseña en Google | Generar con [Google's Review URL generator](https://developers.google.com/maps/documentation/urls/get-api-key) |

Los enlaces a redes sociales en `LINKS` (Instagram, Facebook, Twitter) se configuran con las URLs reales de tus perfiles. Si no configurás estos valores, los enlaces aparecerán como `#` en el sitio.

### Almacenamiento de imágenes

Las imágenes se guardan como base64 en la base de datos Neon (PostgreSQL), por lo que no requieren servicios externos ni se pierden en cold starts.

Opcionalmente, podés usar Vercel Blob para almacenamiento externo:
- Configurar `BLOB_READ_WRITE_TOKEN` en Render

## Tecnologías

- Frontend: HTML, CSS, JavaScript vanilla
- Backend: Node.js, Express
- Base de datos: PostgreSQL (Neon)
- Deploy: Vercel, Render

## Mejoras implementadas

- Búsqueda y filtrado avanzado de productos (texto, categoría, precio mínimo/máximo).
- Gestión de usuarios del panel admin (crear, editar, eliminar, roles).
- Sistema de cupones de descuento (porcentaje y monto fijo) con validación en backend.
- Externalización de URLs hardcodeadas a variables de entorno.
- Tests unitarios ampliados para controladores críticos (orders, payments, auth).
- Documentación de entorno de staging (`docs/staging.md`).
