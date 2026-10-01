# AGENTS.md

## Build & Run Commands

### Frontend (root)
- `npm test` — runs Jest with jsdom environment, config: `tests/unit/jest.config.js`
- `npm run lint` — ESLint: `eslint frontend/js/ tests/ --ext .js`
- `npm run e2e` — Playwright E2E, config: `playwright.audit.config.js`
- `npm run build` — Vite build (output: `dist/`)

### Backend
- `npm test` (in `backend/`) — runs Jest, config: `backend/jest.config.js`
- `npm run lint` (in `backend/`) — ESLint: `eslint src --ext .js`
- `npm start` (in `backend/`) — starts server on port 3000

## Test & Lint Summary

| Scope      | Test Command         | Lint Command        | E2E Command                    |
|------------|----------------------|---------------------|--------------------------------|
| Frontend   | `npm test` (root)    | `npm run lint`      | `npm run e2e`                  |
| Backend    | `cd backend && npm test` | `cd backend && npm run lint` | —                          |

## Deploy

- Frontend: Vercel (outputDirectory: `dist`, rewrites `/api/*` → Render)
- Backend: Render (`render.yaml`, rootDirectory: `backend`)
- Backend URL: `https://iara-os3h.onrender.com`
- Frontend URL: `https://artesania-gualeguay-v3.vercel.app`

## Environment

- Copy `.env.example` to `.env` and fill values
- Backend requires: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASS_HASH`

 Always run both test suites and both linters before finalizing changes.

 ## WhatsApp Integration

 ### ⚠️ NÚMERO DE WHATSAPP — CONFIRMAR CON EL DUEÑO
 El número configurado actualmente es `+543444634444` (formato E.164 sin el 9).
 **CONFIRMAR con el dueño que este es el número real de WhatsApp Business.**
 Las variables de entorno a actualizar son: `WHATSAPP` (backend) y `CONFIG.CONTACT.WHATSAPP` (frontend).

 El formato E.164 para WhatsApp en Argentina es: `54` + código de área (sin 0) + número (sin 15), SIN el 9 intermedio.
 Ejemplo: `543444634444` (Gualeguay, Entre Ríos).

 El número con 9 (`+5493444634444`) es el formato para llamadas telefónicas NORMALES y causa ERR_CONNECTION_CLOSED en wa.me.
 Para tel: links (llamadas telefónicas), el 9 SÍ se usa correctamente.
