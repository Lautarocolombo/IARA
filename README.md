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
├── .env.example
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
cd backend && npm start

# Abrir navegador
http://localhost:3000
```

## Deploy

- **Frontend (Vercel):** `https://artesaniagualeguay.vercel.app`
- **Backend (Render):** `https://iara-backend.onrender.com`

### Checklist de variables de entorno para Render

Antes de deployar el backend en Render, completar estas variables en **Dashboard > Environment**:

#### Obligatorias (siempre)

| Variable | Descripción | Cómo obtener |
|----------|-------------|--------------|
| `JWT_SECRET` | Secreto para firmar tokens JWT | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CSRF_SECRET` | Secreto para protección CSRF | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ADMIN_USER` | Usuario del panel admin | Ej: `Iara` |
| `ADMIN_PASS_HASH` | Hash bcrypt de la contraseña admin | `node -e "const bcrypt=require('bcrypt'); bcrypt.hash('tu-clave',10).then(h=>console.log(h))"` |

#### Obligatorias en producción

| Variable | Descripción | Valor recomendado |
|----------|-------------|-------------------|
| `DATABASE_URL` | Connection string de PostgreSQL | Render la provee automáticamente al crear una DB |
| `ALLOWED_ORIGINS` | Orígenes permitidos para CORS | `https://artesaniagualeguay.vercel.app,https://*.vercel.app,http://localhost:3000` |

#### Opcionales recomendadas

| Variable | Descripción | Default |
|----------|-------------|---------|
| `SITE_URL` | URL base del frontend | `https://artesaniagualeguay.vercel.app` |
| `BACKEND_URL` | URL base del backend | `https://iara-backend.onrender.com` |
| `WHATSAPP` | Número de WhatsApp para notificaciones | `+5493444634444` |
| `EMAIL_FROM` | Remitente de emails | `noreply@artesaniagualeguay.com` |
| `ADMIN_NOTIFICATION_EMAIL` | Email para notificaciones internas | `admin@artesaniagualeguay.com` |
| `RESEND_API_KEY` | API key de Resend para envío de emails | (vacío si no usás emails) |
| `LOG_LEVEL` | Nivel de logging | `info` |
| `SHIPPING_COST` | Costo de envío por defecto | `200` |
| `SHIPPING_THRESHOLD` | Monto mínimo para envío gratis | `2000` |

#### Almacenamiento de imágenes

| Variable | Descripción |
|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob para persistir uploads en producción |
| `CLOUDINARY_CLOUD_NAME` | (alternativa) Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | (alternativa) Cloudinary API key |
| `CLOUDINARY_API_SECRET` | (alternativa) Cloudinary API secret |

> **Nota:** Sin estas variables, en Render las imágenes se guardan en `/tmp` y se pierden al reiniciar. Configurá Vercel Blob o Cloudinary para persistencia real.

### Variables de entorno en Vercel

Configurar en **Vercel Dashboard > Settings > Environment Variables**:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |

> El frontend es 100% estático; las variables de negocio se consultan al backend.

### Analytics (opcional)

Completar en el dashboard de Vercel si usás estos servicios:

| Variable | Descripción |
|----------|-------------|
| `GOOGLE_ANALYTICS_ID` | ID de Google Analytics |
| `FACEBOOK_PIXEL_ID` | ID del Meta Pixel |
| `SENTRY_DSN` | DSN de Sentry para monitoreo de errores |

## Validación al arrancar

El servidor valida todas las variables obligatorias al iniciar. Si falta alguna, muestra un mensaje claro con la variable faltante y cómo generarla. Las variables opcionales faltantes se advierten como warnings pero no impiden el arranque.

## Tests

```bash
# Tests unitarios y de integración (backend)
cd backend && npm test

# Tests E2E (frontend)
npm run e2e
```

## Prevención: detección temprana de variables faltantes

Para evitar que un deploy llegue a producción sin variables configuradas, se recomienda agregar uno de estos controles en CI:

### Opción A: script npm local

Agregar en `backend/package.json`:

```json
"scripts": {
  "check-env": "node -e \"const fs=require('fs'); const content=fs.readFileSync('.env.example','utf8'); const vars=content.match(/^([A-Z][A-Z0-9_]*)=/gm)||[]; const required=vars.map(v=>v.slice(0,-1)); const missing=required.filter(v=>!process.env[v]); if(missing.length){console.error('Faltan variables:',missing.join(', '));process.exit(1)}\""
}
```

Y en el workflow de GitHub Actions, antes del deploy:

```bash
cd backend && npm run check-env
```

### Opción B: GitHub Action

Usar `cyberark/env-check-action` o similar para comparar `.env.example` contra los secrets definidos en el repositorio y fallar si falta alguno obligatorio.

## Verificación de seguridad

- No hay credenciales hardcodeadas en el código. Todos los secretos se leen de variables de entorno.
- Los hashes de contraseña se generan con bcrypt y nunca se guardan en texto plano.
- Los tokens JWT y CSRF se generan con `crypto.randomBytes` y se almacenan en variables de entorno.

## Tecnologías

- Frontend: HTML, CSS, JavaScript vanilla
- Backend: Node.js, Express
- Base de datos: PostgreSQL (Render / Neon)
- Deploy: Vercel (frontend), Render (backend)
