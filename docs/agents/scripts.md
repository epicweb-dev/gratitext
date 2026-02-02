# Scripts

- `npm run dev`: starts dev server with `NODE_ENV=development` and `MOCKS=true`.
- `npm run build`: runs `build:icons`, then `react-router build`.
- `npm run start`: production server (`NODE_ENV=production`).
- `npm run setup`: full setup (build, ensure DB, generate SQL, migrate, seed,
  Playwright install).
- `npm run validate`: runs `test -- --run`, `lint`, `typecheck`, and
  `test:e2e:run` in parallel. The test:e2e:run step runs the build.
- `npm run postinstall` (auto): ensures Prisma DB and runs
  `prisma generate --sql`.
