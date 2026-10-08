# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- LICENSE file (Copyright 2026 Nexora Studio / Metagro SRL)
- CHANGELOG.md with Keep a Changelog format
- README stats script (`npm run docs:stats`)

### Changed
- API v1 is now canonical (`/api/v1/`); `/api/` deprecated with `Deprecation`, `Sunset`, and `Link` headers
- Swagger/OpenAPI documentation published at `/docs`
- Coverage thresholds adjusted to measured values (ratchet approach)
- Removed massive coverage exclusions; only justified individual exclusions remain

### Fixed
- JWT_SECRET and CSRF_SECRET no longer regenerate on each deploy (Render `generateValue: false`)
- Server fails fast in production if required secrets are missing
- CSRF protection never degrades silently; explicit warning in dev, required in prod
- Rate-limit and BullMQ show visible warnings when Redis is not configured in production
- Deploy workflow smoke-test uses bash/curl instead of PowerShell
- Build output (`dist/`) no longer contains node_modules, tests, or config files
- Dockerfile removed (not used in Vercel + Render deployment)

### Security
- Added startup validation for required environment variables
- MP_WEBHOOK_SECRET added to environment configuration

## [2.0.0] - 2026-10-08

### Added
- **Fase 4**: 107 new tests for previously uncovered backend modules:
  - configController (15 tests)
  - inventoryController (22 tests)
  - sectionContentController (12 tests)
  - asyncHandler (5 tests)
  - audit (19 tests)
  - imageService (25 tests)
- **Fase 3**: API v1 canonical with deprecation headers and metrics endpoint
- **Fase 1E**: Deploy workflow smoke-test rewritten in bash
- **Fase 1F**: Clean build output with dedicated `public/` folder
- **Fase 1A-C**: Production startup validation, strict CSRF, visible Redis/BullMQ warnings

### Changed
- **Fase 0**: Honest coverage measurement (removed massive exclusions)
- **Fase 1G**: Dockerfile removed (not used in production deployment)
- Frontend API calls migrated from `/api/` to `/api/v1/`
- Swagger servers updated to `/api/v1`

### Removed
- Dockerfile and .dockerignore
- Massive coverage exclusions in Jest configs

### Security
- JWT_SECRET/CSRF_SECRET fixed values (no more `generateValue: true`)
- Startup fails closed if secrets missing in production
- CSRF_SECRET required in production
- Deprecation headers on legacy `/api/` endpoints

## [1.5.0] - 2026-09-22

### Added
- WhatsApp integration with proper E.164 format handling
- Public config route `/api/v1/config`
- Vercel Blob support with `vcp_` token prefix
- Product card hover fixes
- SSE/WebSocket support for real-time sync

### Fixed
- WhatsApp blocked domain workaround
- WhatsApp direct link in checkout flow
- Toggle state persistence
- CSS hover on product cards

### Changed
- Render.yaml environment variables updated
- Deployment sync for Render + Vercel

## [1.0.0] - 2026-08-20

### Added
- Initial e-commerce platform for Metagro SRL (Gualeguay, Entre Ríos)
- Product catalog with categories, images, featured products
- Shopping cart with localStorage persistence
- Checkout with transfer + WhatsApp payment methods
- Admin panel with role-based access (admin/editor)
- Inventory management with movements and alerts
- Order management with receipts and tracking
- Testimonials, hero cards, section content management
- Site settings, shipping configuration
- Coupon system
- Blog system
- Email notifications (Resend)
- Image upload with Vercel Blob / base64 fallback
- Rate limiting, CSRF protection, audit logging
- SQLite (dev) / PostgreSQL (prod) database
- Jest unit tests (frontend + backend)
- Playwright E2E tests
- GitHub Actions CI/CD

### Security
- Helmet CSP headers
- XSS cleaning middleware
- Nonce-based CSP for inline scripts
- SQL injection prevention (parameterized queries)

---

## Legend

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes