# Server performance audit

## Quick start

- Start the app: `bun run dev`
- Benchmark HTTP endpoints: `bun run benchmark:server`
- Benchmark database-heavy flows: `bun run benchmark:perf`
- Seed larger datasets (optional): `bun run benchmark:data`

## Perf logging (server)

Enable request timing logs:

- `PERF_LOGGING=true`
- `PERF_SLOW_THRESHOLD_MS=250`
- `PERF_LOG_SAMPLE_RATE=0.05`
- `PERF_LOG_SKIP_PATHS=/assets,/build,/favicons,/img,/fonts`

Each log line is prefixed with `server-perf:` and contains JSON with request
duration, CPU usage, event loop utilization, and memory usage.

## Benchmark server endpoints

```
bun run benchmark:server --base-url http://localhost:3000 --iterations 20 --concurrency 4
```

Options:

- `--route /path` (repeatable, overrides defaults)
- `--timeout 10000` (ms)
- `--output ./tmp/benchmark-server.json`

## Benchmark database paths

```
bun run benchmark:perf --iterations 5
```

This measures:

- Recipients list query + schedule computation
- Past messages counts + page fetch
- Cron query + schedule computation

## Audit checklist

1. Compare baseline vs post-deps upgrade using `benchmark:server` and `benchmark:perf`.
2. Enable `PERF_LOGGING` and look for slow routes or high event loop utilization.
3. Check Prisma slow query logs (`PRISMA_QUERY_LOG_THRESHOLD_MS`) and compare to
   request timing logs.
4. Validate cron query performance (`benchmark:perf` -> `cron`).
5. Profile CPU (Node `--cpu-prof`) during a `benchmark:server` run if hot paths
   are not obvious.
