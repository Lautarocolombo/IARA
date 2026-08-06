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



## Deploy

- **Vercel (producción):** `https://iara-ivory.vercel.app`
- **Render (alternativo):** `https://iara-uxcu.onrender.com`

### Variables de entorno en Vercel

Configurar en **Vercel Dashboard > Settings > Environment Variables**:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | string seguro aleatorio |
| `ADMIN_USER` | tu usuario admin |
| `ADMIN_PASS_HASH` | hash bcrypt de tu contraseña admin (generar con `bcrypt.hash('contraseña', 10)`) |
| `ALLOWED_ORIGINS` | `https://iara-ivory.vercel.app,http://localhost:3000` |
| `DATABASE_URL` | connection string de Neon |
| `RESEND_API_KEY` | (opcional) |
| `EMAIL_FROM` | `noreply@artesaniagualeguay.com` |
| `ADMIN_NOTIFICATION_EMAIL` | `admin@artesaniagualeguay.com` |

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

### Cloudinary / Uploads

En Vercel los uploads se guardan en `/tmp` (efímero). Para persistencia de imágenes, configurar:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Si no se configura Cloudinary, las imágenes subidas desde el admin se pierden en cada cold start de Vercel.

## Tecnologías

- Frontend: HTML, CSS, JavaScript vanilla
- Backend: Node.js, Express
- Base de datos: PostgreSQL (Neon)
- Deploy: Vercel, Render
