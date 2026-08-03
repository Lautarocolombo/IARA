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

- **Vercel (producción):** `https://iara-lovat.vercel.app`
- **Render (alternativo):** `https://iara-uxcu.onrender.com`

### Variables de entorno en Vercel

Configurar en **Vercel Dashboard > Settings > Environment Variables**:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | string seguro aleatorio |
| `ADMIN_USER` | tu usuario admin |
| `ADMIN_PASS_HASH` | hash bcrypt de tu contraseña admin (generar con `bcrypt.hash('contraseña', 10)`) |
| `ALLOWED_ORIGINS` | `https://iara-lovat.vercel.app,http://localhost:3000` |
| `DATABASE_URL` | connection string de Neon |
| `RESEND_API_KEY` | (opcional) |
| `EMAIL_FROM` | `noreply@artesaniagualeguay.com` |
| `ADMIN_NOTIFICATION_EMAIL` | `admin@artesaniagualeguay.com` |

> Importante: No subas `backend/.env` a Git. Usá `vercel env add` o el Dashboard.

### Analytics

Reemplazar los placeholders en `frontend/js/config.js`:
- `ANALYTICS.GOOGLE_ID` → tu ID de Google Analytics
- `ANALYTICS.FACEBOOK_PIXEL_ID` → tu ID de Meta Pixel

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
