# Opciones para URL hardcodeada en vercel.json

## Problema actual

`vercel.json` contiene rewrites con URL hardcodeada a Render:
```json
{
  "source": "/api/(.*)",
  "destination": "https://iara-uxcu.onrender.com/api/$1"
}
```

Si el deployment de Render cambia de URL, el proxy se rompe.

## Opción 1: Dominio personalizado en Render (Recomendada)

Configurar un dominio personalizado estable en Render (ej: `api.artesaniagualeguay.com`) y usar ese dominio fijo en `vercel.json`.

Pasos:
1. Comprar/verificar dominio en registrador
2. En Render: **Settings** → **Custom Domains** → agregar `api.artesaniagualeguay.com`
3. Actualizar DNS para apuntar a Render
4. Cambiar `vercel.json` a usar el dominio personalizado

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

## Opción 3: Servidor backend monolítico

Hacer que el backend sirva tanto la API como el frontend estático, eliminando la necesidad de proxy.

Pasos:
1. Configurar backend para servir `/frontend` como estático
2. Actualizar `vercel.json` para apuntar al propio backend
3. O directamente deployar solo el backend

Pros:
- Sin proxy, sin URLs hardcodeadas
- Arquitectura más simple

Contras:
- Requiere cambios en servidor
- Menos optimizado para estáticos que Vercel

## Recomendación actual

Mantener la documentación en `vercel.json` y planificar la Opción 1 (dominio personalizado) para producción a mediano plazo.
