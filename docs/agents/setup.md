# Setup

Start with:

```
git clone https://github.com/kentcdodds/gratitext.git
cd gratitext
cp .env.example .env
rm -f prisma/sqlite.db prisma/sqlite.db-journal
npm install
npm run setup
```

The `npm run setup` script does the following:

- Build the app
- Ensure the Prisma DB is present
- Generate the Prisma SQL
- Migrate the DB
- Seed the DB
- Install the Playwright browsers

You can then run `npm run validate` to verify everything is working before you
get started working.
