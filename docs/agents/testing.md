# Testing

- Backend unit tests use Bun (`bun run test`) for `*.test.ts`.
- Browser unit tests use Vitest (`bun run test:browser`) for
  `*.test.browser.tsx`.
- Coverage via `bun run coverage` (browser tests).
- E2E tests use Playwright (`bun run test:e2e:run` for CI,
  `bun run test:e2e:dev` for UI).
- Playwright fixtures live in `tests/playwright-utils.ts`:
  - `insertNewUser` creates a user and cleans up after the test.
  - `login` creates a session cookie directly and cleans up afterward.
  - `retryDbOperation` wraps flaky DB operations with exponential backoff.
- Test data helpers live in `tests/db-utils.ts` with `createUser`,
  `createRecipient`, and `createMessage` factories.
