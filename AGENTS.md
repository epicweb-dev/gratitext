# Agent instructions

GratiText helps people send thoughtful gratitude notes to loved ones on a
regular schedule.

## Essentials

- Node version: `^24`
- Build: `npm run build` (runs `build:icons`, then `react-router build`)
- Typecheck: `npm run typecheck` (runs `react-router typegen`, then `tsc`)

### Setup script

Run `npm run setup` to:

- Build the app
- Ensure the Prisma DB is present
- Generate the Prisma SQL
- Migrate the DB
- Seed the DB
- Install the Playwright browsers

## More instructions

- [Data access rules](docs/agents/data-access.md)
- [Git workflow rules](docs/agents/git-workflow.md)
- [Routing](docs/agents/routing.md)
- [Auth and session](docs/agents/auth-session.md)
- [Environment and config](docs/agents/env-config.md)
- [Testing](docs/agents/testing.md)
- [Cron jobs and scheduling](docs/agents/cron-jobs.md)
- [Caching and performance](docs/agents/caching-performance.md)
- [UI and styling](docs/agents/ui-and-styling.md)
- [Error handling](docs/agents/error-handling.md)
- [Naming and structure](docs/agents/naming-and-structure.md)
- [Scripts](docs/agents/scripts.md)
- [Security](docs/agents/security.md)
