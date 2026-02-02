# Routing

- Route config lives in `app/routes.ts` and uses `remix-flat-routes` with
  `remixRoutesOptionAdapter`.
- Files ignored as routes: dotfiles, `*.css`, `*.test.*`, `__*`, `*.server.*`,
  and `*.client.*`.
- If a route filename needs the literal word `server` or `client`, use escape
  brackets like `my-route.[server].tsx` so it is not ignored.
