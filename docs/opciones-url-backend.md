# Opciones para URL del backend en Vercel

## Estado actual

`vercel.json` usa rewrites hacia el backend en Render:

```json
{
  "source": "/api/(.*)",
  "destination": "https://iara-backend.onrender.com/api/$1"
}
```

Esta configuración funciona mientras el servicio de Render mantenga esa URL.

## Opción 1: Dominio personalizado en Render (Recomendada)

Configurar un dominio personalizado estable en Render (ej: `api.artesaniagualeguay.com`) y usar ese dominio fijo en `vercel.json`.

Pasos:
1. Comprar/verificar dominio en registrador
2. En Render: **Settings** → **Custom Domains** → agregar `api.artesaniagualeguay.com`
3. Actualizar DNS para apuntar a Render
4. Cambiar `vercel.json` y `render.yaml` a usar el dominio personalizado

Pros:
- URL estable y predecible
- Profesional
- No requiere cambios de código

Contras:
- Costo del dominio (~$10-15 USD/año)
- Requiere configuración DNS

## Opción 2: Vercel Edge Functions como proxy

Crear una Edge Function en Vercel que proxyee `/api/*` al backend, leyendo `BACKEND_URL` de environment variables.

Pasos:
1. Crear `api/[...path].js` en raíz del proyecto Vercel
2. Usar `process.env.BACKEND_URL` para redirigir
3. Deploy a Vercel

Pros:
- URL dinámica via env vars
- No requiere dominio propio

Contras:
- Requiere migrar a Vercel Functions
- Latencia adicional
- Costo en Vercel (plan Hobby tiene límites)

## Recomendación actual

Mantener la configuración actual con `iara-backend.onrender.com` y planificar la Opción 1 (dominio personalizado) para producción a mediano plazo.
