# Deployment - Frontend

## Variables de entorno

### Vercel

```env
VITE_API_BASE=https://tu-backend.onrender.com
```

## Build settings

- **Framework Preset**: Vite
- **Build Command**: `npm run build` (o `vite build`)
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## Pasos

1. Conectar repo de GitHub a Vercel
2. Framework: Vite
3. Configurar `VITE_API_BASE` con la URL del backend
4. Deploy

## Notas

- El frontend consume la API del backend via `VITE_API_BASE`
- Las imágenes se sirven desde el backend (`/uploads`) o Cloudinary CDN
- No requiere base de datos ni servicios adicionales
