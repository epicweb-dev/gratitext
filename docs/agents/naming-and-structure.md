# Naming and project structure

- Use `*.server.*` and `*.client.*` for server/client-specific modules.
- Tests use `*.test.{js,jsx,ts,tsx}` naming.
- Files starting with `__` are treated as non-route helpers.
- Path aliases:
  - `#app/*` maps to `app/*`
  - `#tests/*` maps to `tests/*`
