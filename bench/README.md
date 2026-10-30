# Benchmarks

End-to-end, wall-clock comparisons between the working tree and a baseline. For microbenchmarks of individual functions, see the `*.bench.ts` files run by `vitest bench`.

```bash
pnpm bench                                   # all suites against origin/main
pnpm bench --baseline ref:<sha>              # any git ref
pnpm bench --baseline <version>              # a published nuxt version or tag
pnpm bench --baseline npm:nuxt-nightly@5x    # or an npm alias
pnpm bench --suite dev --suite hmr --fixture large --reps 10
```

Both the working tree and `ref:` baselines are packed with `pnpm pack` and installed with `npm` into an empty project, so every run exercises the published `dist` output rather than source. Uncommitted changes are included in the head build. Installs, fixtures and the report live in `~/.cache/nuxt-bench` (change it with `--workdir`); `ref:` checkouts are cached there by commit. The fixtures target Nuxt 5, so baselines must be Nuxt 5 too.

Runs alternate between baseline and head so that drift on a shared or busy machine affects both equally. Compare the deltas rather than the absolute timings, and treat changes within the min/max range as noise.

## Suites

| Suite | Measures |
| --- | --- |
| `footprint` | installed packages, `node_modules` size, packed tarball size |
| `modules` | JavaScript modules and bytes of source evaluated by `nuxt prepare` |
| `prepare` | `nuxt prepare` wall time |
| `dev` | cold and warm `nuxt dev`, from spawn to the first rendered page, then the first request to a second page |
| `hmr` | time from editing a component until a dev server SSR response contains the change |
| `build` | `nuxt build` wall time, client JS size (raw and gzip) and server output size |
| `render` | requests per second and latency of the production server |
| `client` | gzipped JS, CSS and HTML each server-rendered route loads before hydration, and the total client JS |
| `browser` | hydration time, blocking time and interaction latency in headless Chromium at 8x CPU slowdown (opt-in) |

Every suite runs by default except `browser`, which needs `pnpm exec playwright-core install chromium-headless-shell` once and is too noisy for CI. Its timings spread by up to 2x between runs of the same build, so give it plenty of `--reps` and check the min/max range before trusting a delta. The `client` suite's byte counts are deterministic.

## Fixtures

- `minimal`: a single `app.vue`.
- `large`: a generated app with ~170 pages, ~370 components, plugins, middleware, server routes and a layer (see `test/bench/large-app.ts`).
- `ui`: a [Nuxt UI](https://ui.nuxt.com) landing page and blog index with a shared layout, ~690 component instances in all (see `fixtures/ui`). The dependencies in its `package.json` are installed alongside `nuxt` in a project of its own, so it is only used by the `client` and `browser` suites unless you pass `--fixture ui`.

## CI

The `bench` workflow runs on every ready-for-review pull request that touches `packages/` or the benchmarks, and on any pull request labelled `⚡ performance`, comparing against the base branch. It can also be started manually from the Actions tab with any baseline. The report is added to the job summary.

The summary lists regressions and improvements first and collapses everything else. Counts are flagged on any change, client JS sizes from 0.1% and install or server sizes from 1%. Timings are flagged only when the medians differ by 5% or more and each median falls outside the other target's min/max range. The report is posted as a comment on the pull request when something is flagged or the pull request is labelled `⚡ performance`, and an existing comment is always kept up to date.
