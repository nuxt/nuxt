import { performance } from 'node:perf_hooks'
import { resolve } from 'pathe'
import type { NuxtBuilder } from '@nuxt/schema'
import { logger, resolvePath } from '@nuxt/kit'
// NOTE: imported directly (not via `#builder`). The webpack/rspack builders declare
// `#builder` as a *global* ambient module across the workspace typecheck, which would
// shadow Nasti's differently-shaped core. `builder.mjs` still provides the `#builder`
// runtime indirection for the convention; type-checked code resolves the core here.
import { build, createServer } from '@nasti-toolchain/nasti'
import { toNastiConfig } from './config.ts'
import { NastiDevServerPlugin } from './plugins/dev-server.ts'
import { NastiClientManifestPlugin } from './plugins/client-manifest.ts'
import { NastiNodePlugin } from './plugins/nasti-node.ts'
import { SSRStylesPlugin } from './plugins/ssr-styles.ts'
import { ReplacePlugins } from './plugins/replace.ts'
import { RuntimePathsPlugin } from './plugins/runtime-paths.ts'
import { ModulePreloadPolyfillPlugin } from './plugins/module-preload-polyfill.ts'
import { PublicDirsPlugin } from './plugins/public-dirs.ts'

/**
 * Nasti builder for Nuxt.
 *
 * Drives the Nasti (Rolldown-based) core through the same `NuxtBuilder` seam as
 * `@nuxt/vite-builder`: it translates the Nuxt config into a {@link toNastiConfig | Nasti
 * config}, attaches Nuxt's first-party Nasti plugins plus the bridged Vite plugin list,
 * then runs `createServer` (dev) or `build` (production).
 *
 * Status: dev-mode client serving + the client manifest seam are wired (this file +
 * `plugins/dev-server.ts` + `plugins/client-manifest.ts`); dev-mode SSR via Nasti's module
 * runner is added in `plugins/nasti-node.ts`. Where Nasti's surface differs from Vite (no
 * `manifest.json` emission, `index.html`-derived client entry) the relevant plugin flags
 * the gap rather than silently faking it.
 */
export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  const useAsyncEntry = nuxt.options.experimental.asyncEntry || nuxt.options.dev
  const entry = await resolvePath(resolve(nuxt.options.appDir, useAsyncEntry ? 'entry.async' : 'entry'))
  // With SSR the server reuses the universal entry; for `ssr: false` it gets the SPA entry.
  const serverEntry = nuxt.options.ssr
    ? entry
    : await resolvePath(resolve(nuxt.options.appDir, 'entry-spa'))

  const config = await toNastiConfig(nuxt, { serverEntry })

  // Dev-mode SSR IPC bridge (no-op in production) and SSR critical-CSS inlining.
  const nastiNodePlugin = NastiNodePlugin(nuxt)
  const ssrStylesPlugin = SSRStylesPlugin(nuxt)

  // Prepend Nuxt's Nasti-native plugins so they run before the bridged Vite plugins.
  config.plugins = [
    NastiClientManifestPlugin(nuxt, entry),
    ...(nastiNodePlugin ? [nastiNodePlugin] : []),
    NastiDevServerPlugin(nuxt),
    ...PublicDirsPlugin({ dev: nuxt.options.dev, baseURL: nuxt.options.app.baseURL }),
    ...ReplacePlugins(nuxt),
    ...(ssrStylesPlugin ? [ssrStylesPlugin] : []),
    RuntimePathsPlugin(),
    ModulePreloadPolyfillPlugin(entry),
    ...(config.plugins ?? []),
  ]

  // Allow modules to extend the config (used by `extendNastiConfig` / `addNastiPlugin`),
  // then to read the assembled config — mirrors `vite:extend` / `vite:configResolved`.
  await nuxt.callHook('nasti:extend', { nuxt, config })
  await nuxt.callHook('nasti:configResolved', config)

  // ---- Production build -----------------------------------------------------
  if (!nuxt.options.dev) {
    const start = performance.now()
    await build(config)
    await nuxt.callHook('nasti:compiled')
    logger.success(`[nasti-builder] build done in ${Math.round(performance.now() - start)}ms`)
    return
  }

  // ---- Dev server (middleware mode) -----------------------------------------
  // `createServer` invokes each plugin's `configureServer`, so the dev-server plugin has
  // already registered the connect stack with Nitro (`server:devHandler`) by the time this
  // resolves. We only own the lifecycle teardown here.
  const start = performance.now()
  const server = await createServer(config)
  nuxt.hook('close', () => server.close())
  await nuxt.callHook('nasti:compiled')
  logger.success(`[nasti-builder] Nasti dev server booted in ${Math.round(performance.now() - start)}ms`)
}
