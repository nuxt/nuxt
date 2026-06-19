import MagicString from 'magic-string'
import type { Nuxt } from '@nuxt/schema'
import type { NastiPlugin } from '@nasti-toolchain/nasti'

const JS_RE = /\.[cm]?[jt]sx?$/
// Match the define tokens as whole identifiers (avoid `import.meta.servers` etc.).
function buildMatcher (replacements: Record<string, string>): RegExp {
  const keys = Object.keys(replacements)
    .sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(?<![\\w$.])(?:${keys.join('|')})(?![\\w$])`, 'g')
}

function createReplacePlugin (nuxt: Nuxt, consumer: 'client' | 'server'): NastiPlugin {
  const isServer = consumer === 'server'

  // Nasti has no `define` config; these are the `import.meta.*` / compile-time constants
  // Nuxt relies on, replaced textually per environment (Nasti drives `import.meta.env.SSR`
  // itself, so it is intentionally not duplicated here).
  const replacements: Record<string, string> = {
    'import.meta.server': String(isServer),
    'import.meta.client': String(!isServer),
    'import.meta.browser': String(!isServer),
    'import.meta.nitro': 'false',
    'import.meta.dev': String(nuxt.options.dev),
    'import.meta.test': String(!!nuxt.options.test),
    '__NUXT_VERSION__': JSON.stringify(nuxt._version),
    '__NUXT_ASYNC_CONTEXT__': String(nuxt.options.experimental.asyncContext),
  }
  const matcher = buildMatcher(replacements)

  return {
    name: `nuxt:nasti:replace:${consumer}`,
    enforce: 'post',
    // Nasti's `applyToEnvironment` is a boolean filter, so we register one plugin per
    // environment (instead of Vite's single plugin returning per-env replacements).
    applyToEnvironment: environment => environment.consumer === consumer,
    transform (code, id) {
      if (!JS_RE.test(id) || !matcher.test(code)) {
        return
      }
      matcher.lastIndex = 0
      const s = new MagicString(code)
      for (let m = matcher.exec(code); m; m = matcher.exec(code)) {
        const replacement = replacements[m[0]]
        if (replacement !== undefined) {
          s.overwrite(m.index, m.index + m[0].length, replacement)
        }
      }
      if (!s.hasChanged()) {
        return
      }
      return { code: s.toString(), map: s.generateMap({ hires: true }) }
    },
  }
}

/**
 * Per-environment `import.meta.*` / compile-time constant replacement for Nasti.
 *
 * Returns one plugin per environment because Nasti's `applyToEnvironment` is a filter, not
 * Vite's plugin-returning form.
 */
export function ReplacePlugins (nuxt: Nuxt): NastiPlugin[] {
  return [
    createReplacePlugin(nuxt, 'client'),
    createReplacePlugin(nuxt, 'server'),
  ]
}
