---
navigation.title: 'Build Memory Usage'
title: Build Memory Usage
description: How to understand and reduce memory use during `nuxt build`, and how to size CI runners.
---

`nuxt build` often needs more memory than the running app. You generate client and server bundles, run Nitro, and may prerender routes. Graphs, transforms, sourcemaps, and HTML stay in memory for parts of that work.

Nuxt does not publish a fixed memory budget. Peak usage depends on your app, dependencies, config, Node.js version, and preset. Measure a real build on your CI runner before you pick machine size. Runtime memory after deploy is a separate number; do not size production hosts from build peaks.

Reports in [nuxt/nuxt#34849](https://github.com/nuxt/nuxt/issues/34849) (Nuxt 4.4.x, before Vite 8) show peaks from a few gigabytes into double digits on large prerendered sites. Those numbers age quickly after Nuxt and Vite upgrades, so treat them as context and re-measure your own project.

## Reducing Peak Memory

Prerendering dominates for most apps: each route holds HTML and payload data, and higher concurrency multiplies that cost. Sourcemaps (server maps are on by default), Nitro minification of a large server bundle, and very large client dependencies can push the peak further. Change one setting at a time and compare peak RSS on identical builds.

Start with prerender work. Prefer ISR or SWR for large dynamic sections, skip prerender where you do not need static HTML, lower `concurrency`, and avoid crawling every link:

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

Turn off sourcemaps you do not ship:

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  sourcemap: {
    server: false,
    client: false,
  },
})
```

See [`sourcemap`](/docs/4.x/api/nuxt-config#sourcemap) and [Debugging](/docs/4.x/guide/going-further/debugging#sourcemaps).

If the heap spikes near the end of the build, disable Nitro minification:

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  nitro: {
    minify: false,
  },
})
```

One large project saw about 1 GB less peak after turning off server sourcemaps and minification together. Test each option on your own bundle.

When Node.js throws `FATAL ERROR: Reached heap limit` and the machine has free RAM, raise the V8 heap:

```bash [Terminal]
NODE_OPTIONS='--max-old-space-size=8192' npx nuxt build
```

Exit code `137` means the OS killed the process. A larger heap limit does not add physical RAM. `--expose-gc` only exposes `global.gc()`; it does not free objects the build still holds.

If a very large dependency (for example Puppeteer) lands in the client graph, [`nuxt analyze`](/docs/4.x/api/commands/analyze) can show that. For most apps, prerender work matters more than the module graph.

## CI Runners

Pick a runner with more free memory than your measured peak, and leave room for the OS and package manager. Standard GitHub-hosted `macos-latest` runners have about 7 GB of RAM. Standard `ubuntu-latest` runners have 16 GB for public repositories and 8 GB for private repositories. Move to a larger runner or cut workload when peaks approach the limit.

If GitHub Actions kills the build for memory, add swap before `nuxt build`. The job gets slower under swap, but you finish instead of running out of memory:

```yaml [.github/workflows/ci.yml]
- name: Add swap space
  run: |
    sudo fallocate -l 6G /mnt/swapfile
    sudo chmod 600 /mnt/swapfile
    sudo mkswap /mnt/swapfile
    sudo swapon /mnt/swapfile
```

Re-measure after Nuxt, Node.js, or major module upgrades on the same project and runner.

## Measuring

On Linux, peak RSS for the timed command:

```bash [Terminal]
/usr/bin/time -v npx nuxt build
```

For retained allocations, use a heap profile:

```bash [Terminal]
NODE_OPTIONS='--heap-prof' npx nuxt build
```

Open the `.heapprofile` in Chrome DevTools. Profiling adds overhead, so size CI from normal builds.

You can also log RSS and heap at build hooks in the main process:

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

[`nuxt build --profile`](/docs/4.x/api/commands/build) reports RSS and heap deltas for build stages and writes a CPU profile. Use it to find slow stages; it does not produce a retained-allocation heap profile.

When you open an OOM issue, include Nuxt and Node.js versions, peak RSS, runner RAM, sourcemap settings, prerender route count, preset, and major module versions.
