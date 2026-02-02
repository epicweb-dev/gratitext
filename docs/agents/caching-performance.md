# Caching and performance

- Caching uses `@epic-web/cachified` with two layers:
  - SQLite cache stored at `CACHE_DATABASE_PATH`.
  - In-memory LRU cache (`lru-cache`) for hot entries.
- Cache writes happen on the primary instance; non-primary instances forward
  updates via `updatePrimaryCacheValue`.
- `cachified()` wraps `@epic-web/cachified` and adds Server-Timing metrics via
  `cachifiedTimingReporter`.
- Use `makeTimings()` and `time()` from `app/utils/timing.server.ts` to emit
  Server-Timing headers and measure important work.
