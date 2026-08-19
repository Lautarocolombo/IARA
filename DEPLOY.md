# Deploy — Artesanía Gualeguay

## Requisitos

- Node.js 18+
- PostgreSQL (producción) / SQLite (desarrollo)
- Variables de entorno en `.env` (ver `.env.example`)

## Variables obligatorias

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
ALLOWED_ORIGINS=https://artesania-gualeguay.vercel.app,http://localhost:3000,http://localhost:5173
JWT_SECRET=<random 64+ chars>
ADMIN_USER=<username>
ADMIN_PASS_HASH=<bcrypt hash>
SITE_URL=https://artesania-gualeguay.vercel.app
BACKEND_URL=https://iara-os3h.onrender.com
RESEND_API_KEY=<resend key>
EMAIL_FROM=noreply@artesaniagualeguay.com
```

## Deploy en Vercel

1. Conectar repo en Vercel
2. Configurar variables en Vercel Dashboard
3. Build command: `npm run build`
4. Output directory: `dist`
5. Install command: `npm install`
6. El backend se despliega como serverless function en Vercel (`/api/*` → `backend/api.js`)

## Deploy en Render

1. Conectar repo en Render
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Configurar variables de entorno
6. Health check: `/health`

## Notas

- Frontend: Vercel (estático + serverless backend)
- Backend alternativo: Render (standalone, para migración futura)
- Si usás Render como backend primario, configurar `CONFIG.API.BASE` en `frontend/js/config.js` con la URL de Render

## Health checks

- `GET /health` — estado general + DB + Sentry
- `GET /ready` — readiness probe (solo DB)
- `GET /metrics` — memoria, CPU, uptime (protegido por IP/token)

## Rollback

### Vercel
```bash
vercel rollback
```

### Render
1. Ir a Dashboard → Manual Deploy
2. Seleccionar deploy anterior
3. Confirmar rollback

### Base de datos
- Hacer backup antes de migraciones: `pg_dump $DATABASE_URL > backup.sql`
- Para rollback DB: `psql $DATABASE_URL < backup.sql`

## Monitoreo

- Sentry: errores frontend + backend
- Vercel Analytics: métricas de rendimiento
- /metrics: memoria/CPU (acceso restringido)

## Staging

Consultá la documentación de staging para probar cambios antes de producción.

## Comandos locales

```bash
npm run dev          # Backend en puerto 3000
npm test             # Unit tests
npm run lint         # Lint
npm run e2e          # Playwright E2E
cd backend && npm test  # Backend tests
```
