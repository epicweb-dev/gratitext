# Agent instructions

GratiText helps people send thoughtful gratitude notes to loved ones on a
regular schedule.

## Essentials

- Node version: `^24`
- Build: `bun run build` (runs `build:icons`, then `react-router build`)
- Typecheck: `bun run typecheck` (runs `react-router typegen`, then `tsc`)

## More instructions

- [Data access rules](docs/agents/data-access.md)
- [Git workflow rules](docs/agents/git-workflow.md)
- [Setup](docs/agents/setup.md)
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

## Cursor Cloud specific instructions

See also [.cursor/CLOUD.md](.cursor/CLOUD.md) for the command quick reference.

### Node and Bun on the VM

The default `node` on Cursor Cloud VMs may be `/exec-daemon/node` (older than the
repo’s `^24` requirement). Use nvm Node 24 and Bun on your `PATH` before running
scripts, for example:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 24
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$HOME/.bun/bin:$PATH"
```

Install Bun once if missing: `curl -fsSL https://bun.sh/install | bash`

### First-time database setup

After `bun install`, run `bun run setup:env` (copies `.env.example`, migrates
SQLite, generates Prisma client). Optional full local bootstrap:
`bun run setup:local` (build, seed, Playwright Chromium).

### Dev server

`bun run dev` serves on port 3000 with `MOCKS=true` (MSW mocks Twilio/Stripe).
Use a tmux session for long-running dev.

### Seeded demo account

After `bunx prisma db seed`, log in as username `kody` / password `kodylovesyou`
and open `/recipients` to exercise the core product flow.

### Playwright in this environment

`bunx playwright install --with-deps chromium` can stall after the download
reaches 100%. If browser binaries are incomplete, kill stuck install processes,
remove `~/.cache/ms-playwright/__dirlock`, and retry—or run UI checks with
`chromium.launch({ channel: 'chrome' })` using the system Google Chrome package.
