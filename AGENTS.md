# AGENTS.md - Development Guide

## Project Structure

```
/
├── public/          # Frontend (HTML, CSS, JS vanilla)
│   ├── assets/      # Images, fonts, static assets
│   ├── css/         # Stylesheets
│   ├── js/          # JavaScript modules
│   └── pages/       # HTML pages
├── backend/         # Node.js + Express API
│   ├── src/
│   │   ├── controllers/   # Business logic
│   │   ├── middleware/    # Auth, rate limiting
│   │   ├── routes/        # API endpoints
│   │   ├── lib/           # DB, upload, validators
│   │   └── server.js      # Express app
│   ├── uploads/     # Uploaded files (local dev)
│   ├── tests/       # Backend tests
│   └── package.json
├── tests/           # Frontend tests
│   ├── unit/        # Jest unit tests
│   └── e2e/         # Playwright e2e tests
├── database/        # Schema and migrations
└── .github/         # CI workflows
```

## Development

```bash
# Install all dependencies
npm install
cd backend && npm install

# Run backend (SQLite local)
cd backend && npm start

# Run frontend tests
npm test

# Run backend tests
cd backend && npm test

# Run linter
npm run lint
cd backend && npm run lint

# Format code
npm run format
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:
- `ADMIN_USER` / `ADMIN_PASS` - Admin credentials
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DATABASE_URL` - PostgreSQL connection string (optional, uses SQLite locally)
- `MP_ACCESS_TOKEN` - MercadoPago access token
- `ALLOWED_ORIGINS` - Comma-separated allowed origins for CORS

## Testing

- Frontend tests: Jest with jsdom environment
- Backend tests: Jest with Node environment (supertest for API)
- E2E tests: Playwright

## Code Style

- ESLint with Prettier
- CommonJS modules
- Zod for input validation
- pino for structured logging
