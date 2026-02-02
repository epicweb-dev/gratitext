# Recipient job runner

## Overview

`RecipientJob` stores the next time each recipient should be evaluated for
reminders or scheduled sends. The job runner uses a single `setTimeout` to wake
up at the earliest `runAt` and avoids the previous polling interval.

## How it works

- Each recipient has exactly one `RecipientJob` row (unique by `recipientId`).
- `runAt` is set to either:
  - the start of the reminder window (30 minutes before the next scheduled send)
  - or `now` when already inside the reminder window or within the overdue retry
    window
  - or the next scheduled send time when a reminder was just processed
- When a job runs, it:
  - updates the recipient schedule window if it is stale
  - sends a reminder if there is no pending message
  - sends the next message if it is due and ready
  - updates `runAt` for the next reminder/send evaluation
- If there are no jobs (or the next job is far out), the runner performs a
  low-frequency check to pick up newly created jobs.

## Backfill

Existing recipients need jobs created once:

- `npm run backfill:recipient-jobs`

This fills any missing `RecipientJob` rows without starting the scheduler.
