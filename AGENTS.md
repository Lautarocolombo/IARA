# AGENTS.md

## Build & Run Commands

### Frontend (root)
- `npm test` — runs Jest with jsdom environment, config: `tests/unit/jest.config.js`
- `npm run lint` — ESLint: `eslint frontend/js/ tests/ --ext .js`

### Backend
- `npm test` (in `backend/`) — runs Jest, config: `backend/jest.config.js`
- `npm run lint` (in `backend/`) — ESLint: `eslint src --ext .js`

## Test & Lint Summary

| Scope      | Test Command         | Lint Command        |
|------------|----------------------|---------------------|
| Frontend   | `npm test` (root)    | `npm run lint`      |
| Backend    | `cd backend && npm test` | `cd backend && npm run lint` |

Always run both test suites and both linters before finalizing changes.
