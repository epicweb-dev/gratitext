# Security

- Use `checkHoneypot()` from `app/utils/honeypot.server.ts` in form actions to
  reject spam submissions for public forms. Forms behind authentication should
  not be protected by honeypot.
- Our cookie configuration eliminates the need to worry about CSRF attacks.
