# Contribuyendo a IARA - Artesanías Gualeguay

## Índice

1. [Estructura del proyecto](#estructura-del-proyecto)
2. [Requisitos previos](#requisitos-previos)
3. [Configuración del entorno](#configuración-del-entorno)
4. [Flujo de desarrollo](#flujo-de-desarrollo)
5. [Tests](#tests)
6. [Convenciones de código](#convenciones-de-código)
7. [Pull Requests](#pull-requests)
8. [Reportar issues](#reportar-issues)

---

## Estructura del proyecto

```
/
├── frontend/
│   ├── js/                    # JavaScript del frontend
│   │   ├── config.js          # Configuración centralizada
│   │   ├── cart.js            # Carrito de compras
│   │   ├── products.js        # Catálogo de productos
│   │   ├── checkout.js        # Checkout y pagos
│   │   ├── admin/             # Scripts del panel admin
│   │   └── components/        # Componentes reutilizables
│   ├── pages/                 # HTML pages
│   └── ...
├── backend/
│   ├── src/
│   │   ├── controllers/       # Controladores Express
│   │   ├── routes/            # Rutas API
│   │   ├── middleware/         # Middlewares
│   │   ├── lib/               # Librerías utilitarias
│   │   └── ...
│   ├── tests/                 # Tests del backend (Jest)
│   └── ...
├── tests/
│   ├── unit/                  # Tests unitarios frontend (Jest + jsdom)
│   └── e2e/                   # Tests E2E (Playwright)
├── coverage/                  # Reportes de cobertura
└── ...
```

## Requisitos previos

- **Node.js** >= 18.x
- **npm** >= 9.x
- **PostgreSQL** (Neon) para producción, **SQLite** para desarrollo local
- Redis (opcional, para colas BullMQ)

## Configuración del entorno

### Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus valores
```

Variables importantes:
- `DATABASE_URL` - Connection string de PostgreSQL (o SQLite para desarrollo)
- `JWT_SECRET` - Secreto para tokens JWT (mínimo 64 bytes hex)
- `ADMIN_USER` - Nombre de usuario admin
- `ADMIN_PASS_HASH` - Hash bcrypt de la contraseña admin
- `BLOB_READ_WRITE_TOKEN` - Token de Vercel Blob (opcional)

### Frontend

El frontend usa configuración relativa (`CONFIG.API.BASE = ''`) y se conecta al backend mediante URLs relativas. No requiere configuración adicional.

## Flujo de desarrollo

### Iniciar el entorno de desarrollo

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend (opcional, para desarrollo Vite)
npm run dev
```

### Realizar cambios

1. Crear rama feature: `git checkout -b feature/mi-feature`
2. Implementar cambios siguiendo las convenciones de código
3. Agregar tests para el código nuevo o modificado
4. Ejecutar tests y verificar cobertura
5. Commit con mensaje descriptivo
6. Abrir Pull Request

## Tests

### Tests unitarios frontend

```bash
npm test              # Ejecutar tests
npm run test:coverage # Ejecutar con cobertura
```

Configuración: `tests/unit/jest.config.js` (Jest + jsdom)

Archivos cubiertos: `frontend/js/**/*.js` (excluye vendor, analytics, cookie-consent, etc.)

### Tests unitarios backend

```bash
cd backend && npm test          # Ejecutar tests
cd backend && npm run test:coverage  # Ejecutar con cobertura
```

Configuración: `backend/jest.config.js` (Jest + Node)

Los tests usan SQLite en memoria para el entorno de prueba.

### Tests E2E

```bash
npm run e2e   # Playwright E2E tests
```

Los tests E2E usan Playwright y esperan que el backend esté corriendo en `http://localhost:3000`.

### Convenciones de tests

- Los tests deben ser **reales** (no mocks innecesarios) y **pasar** siempre
- Para backend: mockear solo dependencias externas (DB, APIs externas)
- Para frontend: usar jsdom con mocks de DOM apropiados
- Cobertura objetivo: máxima posible para código crítico

## Convenciones de código

### Frontend

- JavaScript vanilla (ES6+)
- Sin framework de frontend (sin React/Vue/Angular)
- Funciones puras donde sea posible
- Manejo de errores explícito
- Sanitización HTML (DOMPurify + escapeHtml)

### Backend

- Node.js + Express 4
- TypeScript no utilizado (JavaScript puro)
- Validación con Zod en rutas críticas
- Logger Pino para logs estructurados
- Parámetros preparados en todas las queries SQL

### Commits

Usar Conventional Commits:

```
feat: nueva funcionalidad
fix: corrección de bug
test: agregar o modificar tests
docs: documentación
refactor: refactorización sin cambios de comportamiento
chore: tareas de mantenimiento
```

## Pull Requests

1. Describir claramente los cambios realizados
2. Incluir screenshots si aplica (frontend)
3. Verificar que todos los tests pasen
4. Verificar que la cobertura no disminuya
5. Un PR por feature/bugfix

## Reportar issues

Para reportar bugs o solicitar features, abrir un issue en el repositorio con:

- **Título** conciso y descriptivo
- **Descripción** detallada del problema
- **Pasos para reproducir** (si aplica)
- **Comportamiento esperado** vs **actual**
- **Entorno** (navegador, SO, versión)
