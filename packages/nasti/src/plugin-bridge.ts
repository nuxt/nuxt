import type { Plugin as VitePlugin } from 'vite'
import type { NastiPlugin } from '@nasti-toolchain/nasti'
import { logger } from '@nuxt/kit'

/**
 * M0 plugin bridge: Vite/Rollup plugin -> Nasti plugin.
 *
 * Nasti's plugin interface (`NastiPlugin`) is intentionally Vite-shaped — it
 * shares hook *names* with Vite (config / configResolved / configureServer /
 * transformIndexHtml / handleHotUpdate / resolveId / load / transform /
 * buildStart / buildEnd / renderChunk / generateBundle / applyToEnvironment /
 * configEnvironment). So the bridge is mostly a pass-through.
 *
 * What is NOT yet bridgeable in M0 (these gates the higher milestones):
 *  - The Rollup `PluginContext`. Nasti exposes a stub (`resolve` / `emitFile` /
 *    `getModuleInfo` / `environment`); Nuxt's plugins lean on the full context
 *    (`this.addWatchFile`, rich `this.resolve` options, `this.getModuleIds`…).
 *  - Hook *shape* differences: Vite's `transformIndexHtml` can be
 *    `{ order, handler }` and receives a context arg; Nasti's takes `(html)`.
 *  - Vite-only hooks with no Nasti equivalent yet: `options`,
 *    `resolveDynamicImport`, the newer `hotUpdate`, `transform`/`load` filters.
 *
 * Rather than silently drop those, we record them per-plugin and emit a single
 * summary warning — that list is the concrete worklist for M1.
 */

/** Hooks we can forward 1:1 (same name, compatible-enough signature). */
const PASSTHROUGH_HOOKS = [
  'buildStart',
  'buildEnd',
  'closeBundle',
  'resolveId',
  'load',
  'transform',
  'renderChunk',
  'augmentChunkHash',
  'generateBundle',
  'config',
  'configResolved',
  'configEnvironment',
  'applyToEnvironment',
  'configureServer',
  'transformIndexHtml',
  'handleHotUpdate',
] as const satisfies ReadonlyArray<keyof NastiPlugin>

/** Vite hooks Nasti has no slot for in M0 — forwarding them would be a no-op. */
const UNSUPPORTED_HOOKS = new Set([
  'options',
  'buildEnd', // note: supported, kept out of this set
  'resolveDynamicImport',
  'hotUpdate',
  'shouldTransformCachedModule',
  'moduleParsed',
  'resolveFileUrl',
  'resolveImportMeta',
  'renderStart',
  'renderError',
  'writeBundle',
  'banner',
  'footer',
  'intro',
  'outro',
  'api',
])
UNSUPPORTED_HOOKS.delete('buildEnd')

const dropped = new Map<string, Set<string>>()

function recordDropped (pluginName: string, hook: string) {
  if (!dropped.has(pluginName)) {
    dropped.set(pluginName, new Set())
  }
  dropped.get(pluginName)!.add(hook)
}

/** Recursively flatten the (possibly nested / async / falsy) Vite plugin array. */
export async function flattenVitePlugins (
  input: unknown,
  acc: VitePlugin[] = [],
): Promise<VitePlugin[]> {
  const resolved = await input
  if (!resolved) {
    return acc
  }
  if (Array.isArray(resolved)) {
    for (const item of resolved) {
      await flattenVitePlugins(item, acc)
    }
    return acc
  }
  if (typeof resolved === 'object' && 'name' in resolved) {
    acc.push(resolved as VitePlugin)
  }
  return acc
}

export function toNastiPlugin (plugin: VitePlugin): NastiPlugin {
  const name = plugin.name || '<anonymous>'
  const out: NastiPlugin = { name }

  if (plugin.enforce) {
    out.enforce = plugin.enforce
  }
  if (plugin.apply && typeof plugin.apply !== 'object') {
    out.apply = plugin.apply as NastiPlugin['apply']
  }

  for (const hook of PASSTHROUGH_HOOKS) {
    const value = (plugin as unknown as Record<string, unknown>)[hook]
    if (value == null) {
      continue
    }

    // Vite allows the "object hook" form `{ order, handler, filter }`.
    // Nasti expects a bare function, so unwrap to `.handler`.
    const fn = typeof value === 'object' && value !== null && 'handler' in value
      ? (value as { handler: unknown }).handler
      : value

    if (typeof fn !== 'function') {
      recordDropped(name, hook)
      continue
    }

    if (hook === 'transformIndexHtml') {
      // Vite passes (html, ctx); Nasti passes (html). Drop the ctx arg.
      out.transformIndexHtml = (html: string) => (fn as (h: string) => unknown)(html) as never
      continue
    }

    // Pass the rest straight through. `this` (PluginContext) is the Nasti stub;
    // plugins that reach for Rollup-only context members will throw at runtime —
    // that surfaces the real M1 gap instead of hiding it.
    ;(out as unknown as Record<string, unknown>)[hook] = fn
  }

  // Record Vite-only hooks we cannot forward, for the summary warning.
  for (const key of Object.keys(plugin)) {
    if (UNSUPPORTED_HOOKS.has(key)) {
      recordDropped(name, key)
    }
  }

  return out
}

/**
 * Bridge the full Nuxt-assembled Vite plugin list. Logs a single summary of the
 * hooks that could not be forwarded — the M1 worklist.
 */
export async function bridgeVitePlugins (vitePlugins: unknown): Promise<NastiPlugin[]> {
  dropped.clear()
  const flat = await flattenVitePlugins(vitePlugins)
  const bridged = flat.map(toNastiPlugin)

  if (dropped.size > 0) {
    const lines = [...dropped.entries()]
      .map(([plugin, hooks]) => `  - ${plugin}: ${[...hooks].join(', ')}`)
      .join('\n')
    logger.warn(
      `[nasti-builder] M0 could not forward some Vite plugin hooks to Nasti.\n` +
      `These are expected gaps (tracked for M1):\n${lines}`,
    )
  }

  logger.info(`[nasti-builder] bridged ${bridged.length} Vite plugin(s) to Nasti.`)
  return bridged
}
