# Rotación de credenciales Neon

## Estado actual: CRÍTICO

El archivo `backend/.env` contiene credenciales completas de Neon PostgreSQL expuestas:
- `DATABASE_URL` con usuario `neondb_owner` y contraseña visible
- `NEON_DATABASE_URL` con las mismas credenciales

Aunque el archivo está en `.gitignore`, **asumí que la contraseña ya fue comprometida** y rotala inmediatamente.

## Pasos para rotar

### 1. Rotar contraseña en Neon Dashboard
1. Ir a https://neon.tech/
2. Seleccionar el proyecto `neondb`
3. Ir a **Settings** → **Connection**
4. Click en **Reset password** para el usuario `neondb_owner`
5. Copiar la nueva contraseña generada

### 2. Actualizar DATABASE_URL en Render
1. Ir a https://dashboard.render.com/
2. Seleccionar el servicio backend (ej: `iara-uxcu`)
3. Ir a **Environment**
4. Actualizar `DATABASE_URL` con la nueva connection string:
   ```
   postgresql://neondb_owner:NUEVA_CONTRASEÑA@ep-purple-water-axuf1ls3-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
5. Guardar cambios y esperar el redeploy automático

### 3. Actualizar archivo local
1. Editar `backend/.env` con la nueva `DATABASE_URL`
2. **Nunca** commitear este archivo (ya está en `.gitignore`)

### 4. Verificar conexión
```bash
cd backend
node -e "const {query} = require('./src/lib/db'); query('SELECT 1').then(() => console.log('OK')).catch(e => console.error(e))"
```

## Prevención futura

- Usar secrets de Render/Vercel para producción
- No almacenar credenciales en archivos locales versionados
- Considerar usar un gestor de secrets (Vercel Environment Variables, Render Secrets)
