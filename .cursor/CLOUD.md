# GratiText Cloud Agent Instructions

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with mocks (port 3000) |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e:run` | Run Playwright e2e tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run validate` | Run all checks (tests, lint, typecheck, e2e) |

## Development Mode

Dev server runs with `MOCKS=true` which enables MSW mock server. No external services (Twilio, Stripe) needed for local development.

## Mock Services

When testing SMS flows, mock verification codes are stored in `/workspace/tests/fixtures/texts/`. Read the most recent JSON file to find verification codes.

## Database

SQLite database at `./prisma/sqlite.db`. Use `npx prisma studio` to browse data.

## Testing

- Unit tests: Vitest with browser testing via Playwright
- E2E tests: Playwright with Chromium
- Mock services enabled via MSW

## Key Routes

- `/` - Marketing homepage
- `/login` - User login
- `/signup` - Phone verification signup
- `/recipients` - Dashboard (authenticated)
- `/settings/profile` - User settings
