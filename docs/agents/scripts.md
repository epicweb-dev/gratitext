# Scripts

We use Bun for package management and scripts. Run commands via `bun run`.

- `bun run dev`: starts dev server with `NODE_ENV=development` and `MOCKS=true`.
- `bun run build`: runs `build:icons`, then `react-router build`.
- `bun run start`: production server (`NODE_ENV=production`).
- `bun run setup:env`: copies `.env.example` to `.env`, runs DB migrations,
  generates Prisma SQL, and builds icons (CI-friendly).
- `bun run setup:local`: full setup (build, ensure DB, generate SQL, migrate,
  seed, Playwright install).
- `bun run setup`: alias for `bun run setup:local`.
- `bun run validate`: runs `test`, `lint`, `typecheck`, and `test:e2e:run` in
  parallel. The test:e2e:run step runs the build.
- `bun run postinstall` (auto): ensures Prisma DB and runs
  `prisma generate --sql`.
