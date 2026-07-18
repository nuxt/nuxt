---
navigation.title: 'Build Memory Usage'
title: Build Memory Usage
description: How to understand and reduce memory use during `nuxt build`, and how to size CI runners.
---

`nuxt build` often needs more memory than the running app. The build creates client and server bundles, runs Nitro, and may prerender routes. Module graphs, transforms, sourcemaps, and generated HTML all live in memory for part of that process.

Nuxt does not publish a fixed memory budget. Peak usage depends on your source, dependencies, config, Node.js version, and preset. Measure your own build in CI before you pick a runner size.

## Examples From the Community

These Nuxt 4.x peaks were reported in [nuxt/nuxt#34849](https://github.com/nuxt/nuxt/issues/34849):

| Project | Peak during `nuxt build` |
| --- | --- |
| Minimal app with `@nuxt/ui` | ~3.5–4 GB |
| Large app (421k LOC + 82k lines of i18n JSON) | ~10–11 GB |
| Large app with client/server sourcemaps and thousands of prerendered routes | 12+ GB |

Use them as planning anchors, not as official limits. Runtime memory after deploy is a different number. Do not size production hosts from build peaks.

## What Uses Memory

- **Sourcemaps.** Server maps are on by default (`sourcemap.server: true`). Client maps add more.
- **Prerendering.** Each route renders HTML and payload data; concurrency multiplies that cost.
- **Large graphs.** Big locale JSON, generated code, and heavy modules increase what Vite/Rollup/Nitro must parse.
- **Nitro minify.** Minifying a large server bundle can spike near the end of the build.

Dependency upgrades can change the graph. In the same issue, builds started OOMing on 8 GB runners after `@nuxt/ui` 4.6.1, and other projects using Reka UI-based kits (`@nuxt/ui`, `shadcn-vue`) reported high peaks. Treat those as leads: compare the same app before and after the lockfile change.

## Ways to Reduce Memory

Change one setting at a time and compare peak RSS on identical builds.

### Turn Off Sourcemaps You Do Not Ship

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  sourcemap: {
    server: false,
    client: false,
  },
})
```

See [`sourcemap`](/docs/4.x/api/nuxt-config#sourcemap) and [Debugging](/docs/4.x/guide/going-further/debugging#sourcemaps).

### Disable Nitro `minify` if the Heap Is Tight

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  nitro: {
    minify: false,
  },
})
```

One large project saw about 1 GB less peak after turning off server sourcemaps and minification together. Test each option on your own bundle.

### Limit Prerender Work

Prefer ISR/SWR for large dynamic sections instead of prerendering every URL:

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  routeRules: {
    '/blog/**': { isr: 3600 },
    '/admin/**': { prerender: false },
  },
  nitro: {
    prerender: {
      concurrency: 2,
      crawlLinks: false,
      routes: ['/', '/sitemap.xml'],
    },
  },
})
```

Lower `concurrency` trades build time for less parallel memory use. See [Prerendering](/docs/4.x/getting-started/prerendering) and [Nitro prerender options](https://nitro.build/config#prerender).

### Raise the Node Heap When the Machine Has RAM

```bash [Terminal]
NODE_OPTIONS='--max-old-space-size=8192' nuxt build
```

This helps when Node throws `FATAL ERROR: Reached heap limit` and the host still has free memory. Exit code `137` usually means the OS killed the process. A larger V8 heap does not add physical RAM.

`--expose-gc` only exposes `global.gc()`. It does not free objects the build still holds.

### Shrink What the Bundler Sees

- Lazy-load i18n locales when your module supports it.
- Drop unused modules; prefer focused imports over full barrels.
- Use [`nuxt analyze`](/docs/4.x/api/commands/analyze) to spot unexpected client chunks (useful for the graph, not a full heap profile).

### Nuxt 5 and Rolldown

Nuxt 5 uses [Rolldown](https://rolldown.rs) via Vite 8 for the client pipeline. Nitro still builds the server separately, so a faster client build alone does not guarantee a lower total peak. Measure again after upgrading. See [Migration to Vite 8](/docs/4.x/getting-started/upgrade#migration-to-vite-8).

## Sizing CI

Pick a runner with more free memory than your measured peak, leaving room for the OS and package manager. Stock GitHub-hosted runners (~7 GB usable) sit at the edge for apps with UI kits or heavy prerender. Move to a larger runner or cut workload when peaks approach the limit. Swap can avoid an abrupt kill but slows the build a lot.

Re-measure after Nuxt, Node, or major module upgrades on the same project and runner. That is the clearest signal of a regression.

## How to Measure

Peak RSS for the whole process (Linux, GNU time):

```bash [Terminal]
/usr/bin/time -v npx nuxt build
```

Heap profile when you need retained allocations:

```bash [Terminal]
NODE_OPTIONS='--heap-prof' npx nuxt build
```

Open the `.heapprofile` in Chrome DevTools. Profiling adds overhead, so size CI from normal builds.

Optional stage logs in the main process:

```ts [nuxt.config.ts]
function reportMemory (stage: string) {
  const { heapUsed, rss } = process.memoryUsage()
  const toMiB = (bytes: number) => Math.round(bytes / 1024 / 1024)
  console.log(`[memory] ${stage}: RSS ${toMiB(rss)} MiB, heap ${toMiB(heapUsed)} MiB`)
}

export default defineNuxtConfig({
  hooks: {
    'build:before' () {
      reportMemory('build:before')
    },
    'build:done' () {
      reportMemory('build:done')
    },
  },
})
```

These hooks miss peaks between stages and memory in child processes.

[`nuxt build --profile`](/docs/4.x/api/commands/build) writes a CPU profile. It helps find a slow stage; it does not profile heap.

When you open an OOM issue, include Nuxt and Node versions, peak RSS, runner RAM, sourcemap settings, prerender route count, preset, and major module versions.
