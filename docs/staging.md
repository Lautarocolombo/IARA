# Staging

Este documento describe cómo configurar y usar un entorno de staging para probar cambios antes de llevarlos a producción.

## Requisitos

- Acceso al dashboard de Vercel.
- Acceso al dashboard de Render.
- Permisos de escritura en el repositorio.

## Pasos

### 1. Rama de staging

Creá una rama `staging` en el repositorio:

```bash
git checkout -b staging
git push -u origin staging
```

Todos los cambios que se mergeen a `staging` se desplegarán automáticamente en el entorno de staging.

### 2. Vercel (frontend)

En el dashboard de Vercel:

1. Creá un nuevo proyecto o usá el existente.
2. En **Settings > Git**, conectá el repositorio y seleccioná la rama `staging`.
3. Configurá un dominio de staging (ej: `iara-staging.vercel.app`) en **Settings > Domains**.
4. Asegurá que el rewrite de `/api/*` apunte al backend de staging (por ejemplo, `https://iara-backend-staging.onrender.com`).

Si usás el mismo proyecto de Vercel para staging y producción, podés configurar un **Preview Deployment** por rama.

### 3. Render (backend)

En el dashboard de Render:

1. Creá un nuevo servicio web o usá el existente.
2. En **Settings > Deploy**, seleccioná la rama `staging`.
3. Configurá las variables de entorno:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | string seguro aleatorio |
| `ADMIN_USER` | tu usuario admin |
| `ADMIN_PASS_HASH` | hash bcrypt de tu contraseña admin |
| `ALLOWED_ORIGINS` | `https://iara-staging.vercel.app,http://localhost:3000` |
| `DATABASE_URL` | connection string de Neon (staging) |
| `SITE_URL` | `https://iara-staging.vercel.app` |
| `BACKEND_URL` | `https://iara-backend-staging.onrender.com` |
| `EMAIL_FROM` | `noreply@artesaniagualeguay.com` |
| `ADMIN_NOTIFICATION_EMAIL` | `admin@artesaniagualeguay.com` |

> Nota: Si no tenés un plan pago en Render, no podrás tener dos servicios web simultáneamente. En ese caso, podés cambiar manualmente la rama del servicio existente a `staging` cuando lo necesites.

### 4. Actualizar rewrite de Vercel

Si tu backend de staging tiene una URL diferente, actualizá `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://iara-backend-staging.onrender.com/api/$1"
    },
    ...
  ]
}
```

O, si usás el mismo backend para staging y producción, asegurá que `ALLOWED_ORIGINS` incluya el dominio de staging.

### 5. Probar staging

1. Hacé merge de cambios a la rama `staging`.
2. Verificá que Vercel y Render hagan deploy automáticamente.
3. Accedé a `https://iara-staging.vercel.app` y probá las funcionalidades.

### 6. Promover a producción

Cuando los cambios estén listos:

```bash
git checkout main
git merge staging
git push origin main
```

El deploy a producción se hará automáticamente según la configuración de CI/CD.

## Notas

- La base de datos de staging debería ser separada de la de producción para evitar corrupción de datos.
- Podés usar una base de datos Neon separada para staging y configurarla en la variable `DATABASE_URL` de Render.
- Si usás el mismo backend para staging y producción, recordá cambiar `ALLOWED_ORIGINS` y `SITE_URL` según corresponda.
