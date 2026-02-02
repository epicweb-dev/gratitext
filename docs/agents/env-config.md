# Environment and config

- Environment variables are validated with Zod in `app/utils/env.server.ts`.
- Call `init()` early at server startup to validate required env vars.
- Only expose client-safe vars via `getEnv()`; do not add secrets there.
- Required env vars include:
  - `DATABASE_PATH`, `DATABASE_URL`, `CACHE_DATABASE_PATH`
  - `SESSION_SECRET`, `INTERNAL_COMMAND_TOKEN`, `HONEYPOT_SECRET`
  - `TWILIO_TOKEN`, `TWILIO_SID`
  - `STRIPE_SECRET_KEY`, `STRIPE_BASIC_PAYMENT_LINK`, `STRIPE_BASIC_PRODUCT`,
    `STRIPE_PREMIUM_PAYMENT_LINK`, `STRIPE_PREMIUM_PRODUCT`
  - `ALLOW_INDEXING` is optional.

When initializing the environment, you should copy the `.env.example` file
to `.env` and these values will be filled in with mocked values.
