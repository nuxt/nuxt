import { basename, resolve } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import type { NastiConfig } from '@nasti-toolchain/nasti'
import { bridgeVitePlugins } from './plugin-bridge.ts'
import { ssrEnvironment } from './config/server.ts'

/** Normalise Vite's alias (object or `[{ find, replacement }]`) to a flat record. */
function normaliseAlias (alias: unknown): Record<string, string> {
  if (!alias) {
    return {}
  }
  if (Array.isArray(alias)) {
    const out: Record<string, string> = {}
    for (const entry of alias) {
      if (entry && typeof entry.find === 'string' && typeof entry.replacement === 'string') {
        out[entry.find] = entry.replacement
      }
    }
    return out
  }
  return { ...alias as Record<string, string> }
}

const LOG_LEVEL_MAP: Record<string, NastiConfig['logLevel']> = {
  silent: 'silent',
  fatal: 'error',
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'info',
  trace: 'info',
  verbose: 'info',
}

export interface ToNastiConfigOptions {
  /** Resolved server (SSR / SPA) entry module, used as the `ssr` environment entry. */
  serverEntry: string
}

/**
 * Translate the Nuxt-assembled config into a Nasti config.
 *
 * Nasti's config surface is intentionally smaller than Vite's, so this maps the
 * structurally-shared fields (root / base / mode / framework / alias / outDir) and
 * configures the two environments Nuxt needs via Nasti's Environment API:
 *
 *  - `client` — `consumer: 'client'`. Its entry is served on demand in dev (Nitro emits
 *    the HTML that references the client entry URL; Nasti transforms it per-request). In a
 *    production build Nasti extracts the client entry from an `index.html`, which Nuxt does
 *    not provide — that gap is handled/flagged by the client-manifest plugin.
 *  - `ssr` — `consumer: 'server'`, with an explicit `entry` (Nasti only builds non-client
 *    environments that declare one).
 *
 * The bridged Vite plugin list is attached here; the builder prepends its Nasti-native
 * plugins (dev-server, client-manifest, …) in `nasti.ts`.
 */
export async function toNastiConfig (nuxt: Nuxt, options: ToNastiConfigOptions): Promise<NastiConfig> {
  const viteConfig = nuxt.options.vite as Record<string, any>

  const alias = {
    [basename(nuxt.options.dir.assets)]: resolve(nuxt.options.srcDir, nuxt.options.dir.assets),
    ...normaliseAlias(viteConfig.resolve?.alias),
    ...nuxt.options.alias,
    '#app': nuxt.options.appDir,
  }

  const plugins = await bridgeVitePlugins(viteConfig.plugins)

  return {
    root: nuxt.options.rootDir,
    base: nuxt.options.app.baseURL || '/',
    mode: nuxt.options.dev ? 'development' : 'production',
    framework: 'vue',
    logLevel: LOG_LEVEL_MAP[nuxt.options.logLevel] ?? 'info',
    resolve: {
      alias,
      conditions: viteConfig.resolve?.conditions,
      extensions: viteConfig.resolve?.extensions,
    },
    plugins,
    build: {
      outDir: nuxt.options.buildDir,
      sourcemap: nuxt.options.sourcemap?.client,
    },
    environments: {
      client: {
        consumer: 'client',
      },
      ssr: ssrEnvironment(nuxt, options.serverEntry),
    },
  }
}
