# Git workflow

Push when you feel confident things are working, then immediately run the full
gate.

- Run formatting: `bun run format`.
- Run linting with fixes: `bun run lint -- --fix`.
- Run type checking: `bun run typecheck`.
- Run tests: `bun run test`, plus any relevant e2e suites
  (`bun run test:e2e:run`).
- `bun run validate` can replace `typecheck`, `test`, and `test:e2e:run`, but it
  does not run `format` or `lint -- --fix`.

If anything changes as a result of running the full gate, commit and push that.
If you need to make changes to the codebase, do so in a separate commit and push
that as well.
