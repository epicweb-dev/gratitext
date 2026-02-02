# Error handling

- Prefer `GeneralErrorBoundary` from `app/components/error-boundary.tsx` for
  route error handling with per-status handlers.
- Unexpected errors are reported to Sentry; route errors are handled separately.
- Use `getErrorMessage()` from `app/utils/misc.tsx` to normalize unknown errors.
