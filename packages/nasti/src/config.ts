import type { Nuxt } from '@nuxt/schema'
import type { NastiConfig } from '@nasti-toolchain/nasti'
import { bridgeVitePlugins } from './plugin-bridge'

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

/**
 * Translate the Nuxt-assembled config into a Nasti config.
 *
 * M0 maps the structurally-shared fields (root / framework / alias / outDir /
 * plugins). Nuxt-specific Vite surface that has no Nasti home yet (define,
 * renderBuiltUrl, ssr externals, optimizeDeps, the `environments` block) is
 * deliberately left out — wiring those is M1/M2, and pretending to map them
 * would hide the gap.
 */
export async function toNastiConfig (nuxt: Nuxt): Promise<NastiConfig> {
  const viteConfig = nuxt.options.vite as Record<string, any>

  const alias = {
    ...normaliseAlias(viteConfig.resolve?.alias),
    ...nuxt.options.alias,
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
  }
}
