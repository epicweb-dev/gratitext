# Setup

Start with:

```
git clone https://github.com/kentcdodds/gratitext.git
cd gratitext
cp .env.example .env
rm -f prisma/sqlite.db prisma/sqlite.db-journal
npm install
npm run setup:local
```

The `npm run setup:local` script does the following:

- Build the app
- Ensure the Prisma DB is present
- Generate the Prisma SQL
- Migrate the DB
- Seed the DB
- Install the Playwright browsers

`npm run setup` is a compatibility alias for `npm run setup:local`.

For CI-like setup (used in GitHub Actions), run `npm run setup:env` to copy the
env file, migrate the DB, generate Prisma SQL, and build icons.

You can then run `npm run validate` to verify everything is working before you
get started working.
