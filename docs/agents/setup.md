# Setup

Start with:

```
git clone https://github.com/kentcdodds/gratitext.git
cd gratitext
rm -f prisma/sqlite.db prisma/sqlite.db-journal
bun install
bun run setup:env
bun run setup:local
```

The `bun run setup:local` script does the following:

- Build the app
- Ensure the Prisma DB is present
- Generate the Prisma SQL
- Migrate the DB
- Seed the DB
- Install the Playwright browsers

For CI-like setup (used in GitHub Actions), run `bun run setup:env` to copy the
env file, migrate the DB, generate Prisma SQL, and build icons.

You can then run `bun run validate` to verify everything is working before you
get started working.
