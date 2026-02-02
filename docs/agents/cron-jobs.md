# Cron jobs and scheduling

- Cron processing is implemented in `app/utils/cron.server.ts`.
- `init()` starts a `setIntervalAsync` loop every 5 seconds to send due texts.
- `sendNextTexts()`:
  - Queries recipients via typed SQL (`getrecipientsforcron`).
  - Processes a 30-minute reminder window.
  - Uses sentinel dates for invalid cron strings to prevent reprocessing.
