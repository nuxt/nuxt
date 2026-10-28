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

## Fixtures

- `minimal`: a single `app.vue`.
- `large`: a generated app with ~170 pages, ~370 components, plugins, middleware, server routes and a layer (see `test/bench/large-app.ts`).

## CI

The `bench` workflow runs on pull requests labelled `⚡ performance` (and on every push to them afterwards), comparing against the base branch, and can be started manually from the Actions tab with any baseline. The report is added to the job summary and posted as a comment on the pull request.
