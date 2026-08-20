# Deployment - Frontend

## Variables de entorno

### Vercel

```env
# CONFIG.API.BASE se configura en frontend/js/config.js
# Para apuntar a un backend externo (ej: Render), cambiá BASE de '' a la URL completa
```

## Build settings

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## Pasos

1. Conectar repo de GitHub a Vercel
2. Framework: Vite
3. Deploy

## Notas

- El frontend consume la API via `CONFIG.API.BASE` en `frontend/js/config.js`
- Por defecto usa rutas relativas (`BASE: ''`), lo que aprovecha el rewrite de Vercel a serverless backend
- Si el backend está en Render, cambiar `BASE` a `https://api.artesaniagualeguay.com`
- Las imágenes se sirven desde el backend (`/uploads`) o Vercel Blob
- No requiere base de datos ni servicios adicionales en el frontend
