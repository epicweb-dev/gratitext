# Testing

- Unit tests use Vitest (`bun run test`); coverage via `bun run coverage`.
- E2E tests use Playwright (`bun run test:e2e:run` for CI, `bun run test:e2e:dev` for
  UI).
- Playwright fixtures live in `tests/playwright-utils.ts`:
  - `insertNewUser` creates a user and cleans up after the test.
  - `login` creates a session cookie directly and cleans up afterward.
  - `retryDbOperation` wraps flaky DB operations with exponential backoff.
- Test data helpers live in `tests/db-utils.ts` with `createUser`,
  `createRecipient`, and `createMessage` factories.
