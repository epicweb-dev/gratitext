# Auth and session

- Session cookie uses `en_session`, `sameSite: 'lax'`, `httpOnly: true`, and
  `secure` in production; secrets come from `SESSION_SECRET` (comma-separated).
- Session expiration rules:
  - Idle timeout: 14 days.
  - Absolute max lifetime: 90 days from original creation.
  - Sessions renew when within 7 days of expiration, but never beyond the
    absolute max.
- Use `getUserId`, `requireUserId`, and `requireAnonymous` helpers for auth
  flow.
- `requireUserWithPermission`/`requireUserWithRole` enforce access and respond
  with 403 JSON on failure.
