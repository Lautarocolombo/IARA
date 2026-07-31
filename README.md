# IARA - Artesanía Gualeguay

Sitio web de artesanías con panel de administración integrado.

## Estructura del proyecto

```
/
├── public/
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

## Panel de administración

**URL:** `/pages/admin.html`  
**Credenciales:** definidas en variables de entorno `ADMIN_USER` / `ADMIN_PASS`. Ver `backend/.env.example` para configurarlas localmente. En producción se cargan en Vercel/Render.

## Deploy

- **Vercel:** `https://iara-eight.vercel.app`
- **Render:** `https://iara-yrdx.onrender.com`

## Variables de entorno

| Variable | Descripción |
|---|---|
| `ADMIN_USER` / `ADMIN_PASS` | Credenciales del admin |
| `EDITOR_USER` / `EDITOR_PASS` | Credenciales de editor (opcional) |
| `JWT_SECRET` | Secreto para firmar tokens |
| `DATABASE_URL` | Connection string de PostgreSQL (Neon/Render) |
| `ALLOWED_ORIGINS` | Orígenes permitidos para CORS |
| `MP_ACCESS_TOKEN` | Access token de MercadoPago |
| `MP_WEBHOOK_SECRET` | Secreto para verificar webhooks (opcional) |
| `CLOUDINARY_*` | Upload de imágenes (opcional) |

> **Importante:** No hardcodees credenciales en código ni en `vercel.json`. Usá el dashboard de Vercel (Settings → Environment Variables) o Render para cargar valores sensibles.

## Tecnologías

- Frontend: HTML, CSS, JavaScript vanilla
- Backend: Node.js, Express
- Base de datos: PostgreSQL (Neon)
- Deploy: Vercel, Render
