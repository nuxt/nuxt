# `nuxt dev` performance harness

Tooling for measuring the developer-facing performance of `nuxt dev`, plus the
methodology notes that came out of using it. Start here before any dev-performance
work.

- `generate-fixture.ts` builds synthetic apps of a configurable size.
- `dev-bench.ts` runs the full metric suite against one.
- `cold-probe.ts` measures cold start only, with repeated samples.
- `probe.ts` interleaves edit latency with dev-server logs, for inner-loop work.
- `kill-dev.sh` clears stray dev servers.
- `FINDINGS.md` is the accumulated record of what was measured and what it meant.

## Quick start

```bash
node scripts/bench/generate-fixture.ts --size medium --out .bench/medium

node scripts/bench/dev-bench.ts --fixture .bench/medium --label baseline \
  --port 3300 --out .bench/results/baseline.json

# ...make a change...

node scripts/bench/dev-bench.ts --fixture .bench/medium --label candidate \
  --port 3300 --out .bench/results/candidate.json

node scripts/bench/dev-bench.ts --compare \
  .bench/results/baseline.json .bench/results/candidate.json
```

A full run takes six to twelve minutes depending on fixture size. Run it in the
background and poll the log; per-step progress goes to stderr.

To A/B a flag without editing the fixture by hand:

```bash
node scripts/bench/dev-bench.ts --fixture .bench/medium --label envapi --port 3320 \
  --config-patch "experimental: { nitroViteEnvironment: true }," \
  --out .bench/results/envapi.json
```

Cold start deserves its own tool, because the full harness samples it once:

```bash
node scripts/bench/cold-probe.ts --fixture .bench/medium --runs 5 --port 3500 \
  --variant "default:" \
  --variant "no-env-api:experimental: { nitroViteEnvironment: false },"
```

## Fixtures

| size | components | pages | composables | server routes | CJS deps |
| --- | --- | --- | --- | --- | --- |
| `tiny` | 5 | 3 | 2 | 2 | 0 |
| `small` | 40 | 15 | 10 | 8 | 10 |
| `medium` | 200 | 60 | 40 | 30 | 40 |
| `large` | 800 | 200 | 120 | 80 | 120 |

The `playground` is a single `app.vue` and hides everything that scales with app
size. Use it for debugging, never for measurement.

Always measure at two sizes. The interesting question is usually not "how slow is
it" but "does this cost scale with app size", and only a `medium` versus `large`
comparison answers that. Several of the biggest wins were things that were
invisible at `medium` and obvious at `large`.

The synthetic CJS dependencies exist so that Vite's dependency optimizer is
actually exercised. Without them the fixture has no bare imports to prebundle and
a whole class of cost disappears from the measurement.

## Metrics

| metric | what it means |
| --- | --- |
| `coldReady` | spawn to the port accepting connections, caches empty |
| `warmReady` | the same with every cache populated |
| `firstSSR` | the very first HTML response |
| `warmSSR` | median SSR response once hot |
| `coldRouteSSR` | first request to a route never visited |
| `firstClientLoad` | fetching one page's whole client module graph, as a browser would |
| `warmClientLoad` | the same graph again, transforms cached: a hard reload |
| `reloadClientLoad` | the same graph as a soft reload, one conditional GET per module |
| `clientModules` / `clientBytes` | size of the graph the browser must fetch for one page |
| `hmrServer` / `hmrPage` / `hmrStyle` / `hmrUnused` | save a file, SSR reflects it |
| `hmrClient` | save a file, the HMR websocket emits an update |
| `addComponent` | create a component and use it |
| `hmrServerRoute` | save a server route, new response |
| `restart` | edit `nuxt.config`, dev server usable again |
| `rss` / `rssRoutes` | resident memory of the whole process tree, idle and after visiting every route |

Be precise about which reload you mean. Dev modules are served `Cache-Control:
no-cache` with a weak ETag, so a soft reload is N revalidations that all return
304 and costs very little. The expensive paths are the first load after a restart
and any hard reload, which is also what a developer with "disable cache" ticked in
devtools gets on every reload.

## Methodology rules

These were all learned by getting them wrong first. Every one of them produced a
wrong conclusion that survived until it was checked.

**Treat single-sample metrics as directional only.** `coldReady`, `warmReady`,
`firstSSR` and `restart` are sampled once per run, and cold start varies by well
over 10% run to run. One integration run showed `coldReady` +17%, i.e. an apparent
regression, which repeated sampling showed was actually a 16% improvement. If a
cold-start number matters, use `cold-probe.ts` and quote the distribution, not the
median alone.

**Check for stray dev servers before believing anything.** Two dev servers left
over from manual debugging silently competed for CPU across three benchmark runs
and invalidated all of them. `dev-bench.ts` now refuses to start when it detects
another dev server, and `kill-dev.sh` matches every entrypoint one can be started
from. Keep both of those correct.

**Never match processes on command line alone.** An early `kill-dev.sh` matched
the words it was grepping for, which also appear in the command line of the shell
invoking it, so it killed its own shell. Several experiments silently produced no
output before this was noticed. Match on the executable being node *and* the
script path *and* the subcommand.

**Verify the fixture is complete before measuring.** A `rmSync` racing a dev
server that was still shutting down left a half-generated fixture, which produced
a beautifully fast and completely meaningless run (`firstSSR` 7ms, because most
of the app did not exist). `dev-bench.ts` now asserts key files exist and refuses
to run otherwise.

**Reproduce every reported win yourself, on an idle machine, paired.** A -46%
cold-start improvement turned out to be entirely machine contention: the reported
baseline was 4775ms where an uncontended baseline was 2967ms. Absolute numbers
across machines, containers or sessions are not comparable. Only a
baseline-and-candidate pair measured back to back means anything.

**Run the opposite experiment.** The most useful single result in this cycle came
from testing the inverse of a hypothesis. The question was whether removing
Nuxt's `optimizeDeps` exclusion list would help; removing it changed nothing, and
the decisive evidence was that *forcing* those same packages through
`optimizeDeps.include` also changed nothing. That established the list was inert
in both directions, which neither direction alone would have shown.

**Performance changes need correctness tests, not just benchmarks.** The single
biggest payload win in this cycle (about 1.5MB) broke hydration on every page
using islands or server components, and no benchmark metric noticed, because the
harness measures SSR and module graphs rather than whether the page works. Run
`pnpm test:fixtures:dev` and the `nitro-vite-dev` project on anything that touches
the client graph, module resolution, or aliasing.

**Bisect integration regressions across the merge sequence, not the file diff.**
When seven branches merge cleanly and the suite fails, checking out each
intermediate merge commit and running one representative test file found the
culprit in four steps. Reading diffs would not have.

**`test:prepare` state is part of the experiment.** Fixture `.nuxt` output is not
cleaned by `git checkout`, so a control run can silently inherit build output from
a different branch. Run `pnpm test:prepare` on the branch you are measuring, and
remove leftover fixture directories that only exist on the other branch.

## Where the time actually goes

Useful priors for the next cycle, from profiling with `nuxt dev --profile verbose`
(which writes `<buildDir>/perf-report.json` and a Perfetto trace to
`<buildDir>/perf-trace.json`; note it only flushes on a clean exit, so send
`SIGINT`, never `SIGKILL`).

- **Nuxt's own startup work is a minority of cold start.** On a medium app the
  profiler accounted for roughly 730ms of a 2900ms cold start. Roughly 600ms
  elapses before config loading even begins, and the rest was, once traced
  properly, the first SSR render rather than anything in the startup path.
- **The first SSR render is where the "mystery" time lives.** Two separate
  workstreams independently concluded that the large unexplained block after the
  builder finishes is the first request pulling hundreds of modules through the
  transform pipeline, not process boot or worker startup.
- **Loading one page in a browser is the worst single number.** On a large app it
  was 1602 modules and 22.8MB. Most of that is the dev-mode ESM source of vue,
  vue-router, unhead and h3, served individually because Vite declines to
  prebundle already-ESM packages. Reducing it means shipping less of it, not
  bundling it differently.
- **Memory is dominated by the native allocator, not JS.** rolldown and oxc link
  mimalloc, which eagerly commits its arenas; on Linux those commits are backed by
  transparent huge pages, so RSS tracked arena size rather than live bytes.
  Always separate "allocated" from "retained": run with `NODE_OPTIONS=--expose-gc`
  so the profiler records retained heap after a forced GC at phase boundaries, and
  take real heap snapshots rather than guessing.
- **Per-save work was O(app size) and mostly wasted.** Every save of any file ran
  a full app regeneration that produced zero changed templates. Whenever an
  inner-loop metric scales with app size, that is the bug, even if the absolute
  number looks acceptable at medium size.

## Running this as a parallel-agent exercise

This cycle was nine agents across nine worktrees. What mattered:

- **Build the measurement harness first and make every agent share it.** Agents
  that measure differently produce results that cannot be compared or combined.
  Commit the harness before dispatching.
- **Partition by topic, not by target.** Cold start, memory, HMR, client payload,
  warm cache, and the env-API migration were clean, mostly non-overlapping slices.
  Merge conflicts across seven branches were confined to the shared benchmark
  scripts; there were none in source.
- **Give every agent the same baseline numbers and the same known bugs**, so they
  do not each rediscover them.
- **Expect each agent to measure against its own defaults, and expect that to hide
  interactions.** Two independently correct branches cancelled out: a cache keyed
  to the vite-node pipeline, and a default flip that removed vite-node from the
  path. Neither branch could see it. Integration measurement is not optional.
- **Independently verify headline claims before merging.** Of nine agents, two
  produced headline results that did not survive verification, and both were
  reverted. Ask for the negative results explicitly; the write-ups saying "this
  did not work and here is why" were as valuable as the wins.
- **Correctness bugs are a likely by-product.** Building a realistic fixture and
  exercising it turned up a completely broken feature (server auto-imports, in
  production as well as dev) and a silent data-loss bug in file watching, neither
  of which was a performance issue.
