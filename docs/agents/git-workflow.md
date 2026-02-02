# Git workflow

Push when you feel confident things are working, then immediately run the full
gate.

- Run formatting: `npm run format`.
- Run linting with fixes: `npm run lint -- --fix`.
- Run type checking: `npm run typecheck`.
- Run tests: `npm run test`, plus any relevant e2e suites
  (`npm run test:e2e:run`).
- `npm run validate` can replace `typecheck`, `test`, and `test:e2e:run`, but it
  does not run `format` or `lint -- --fix`.

If anything changes as a result of running the full gate, commit and push that.
If you need to make changes to the codebase, do so in a separate commit and push
that as well.
