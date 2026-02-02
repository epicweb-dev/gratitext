# Data access

- Use typed SQL generated in `prisma/sql/` with `prisma.$queryRawTyped`.
- Do not use `prisma.$queryRaw` or `Prisma.sql`.
- Filename exception: Prisma typed SQL files must be valid JS identifiers (no
  dashes), so the lower-kebab-case rule does not apply under `prisma/sql/`.
