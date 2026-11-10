import type { Nuxt } from '@nuxt/schema'
import { resolveAlias } from '@nuxt/kit'
import escapeRegExp from 'escape-string-regexp'
import { normalize } from 'pathe'

/**
 * Patterns of the modules outside of the project to transpile, including `build.transpile`
 * (whose functions are called with `ctx`).
 */
export function getTranspilePatterns<T extends { isDev: boolean, isClient?: boolean, isServer?: boolean }> (nuxt: Nuxt, ctx: T): RegExp[] {
  const patterns: RegExp[] = [
    /consola\/src/,
    /vue-demi/,
    /(^|\/)nuxt\/(src\/|dist\/)?(app|[^/]+\/runtime)($|\/)/,
  ]

  for (const entry of nuxt.options.build.transpile) {
    const pattern = typeof entry === 'function' ? entry(ctx) || undefined : entry
    if (typeof pattern === 'string') {
      patterns.push(new RegExp(escapeRegExp(normalize(pattern))))
    } else if (pattern instanceof RegExp) {
      patterns.push(pattern)
    }
  }

  return patterns
}

type DevtoolBase = 'cheap-module-source-map' | 'source-map'

/** The `devtool` for a `sourcemap.client` or `sourcemap.server` value. */
export function getDevtool<T extends DevtoolBase> (sourcemap: boolean | 'hidden' | 'nosource', devtool: T): false | T | `hidden-${T}` | `nosources-${T}` {
  if (!sourcemap) {
    return false
  }
  if (sourcemap === 'hidden') {
    return `hidden-${devtool}`
  }
  return sourcemap === 'nosource' ? `nosources-${devtool}` : devtool
}

export function shouldTypeCheck (nuxt: Nuxt): boolean {
  const { typeCheck } = nuxt.options.typescript
  return !nuxt.options.test && (typeCheck === true || typeCheck === (nuxt.options.dev ? 'dev' : 'build'))
}

/**
 * The split chunk cache group separating the CSS of `nuxt.options.css` into a dedicated
 * `nuxt-global-css` chunk, when styles are inlined.
 */
export function getGlobalCSSCacheGroup (nuxt: Nuxt) {
  const inlineStyles = nuxt.options.features.inlineStyles
  if (!inlineStyles) {
    return
  }

  const globalCSSPaths = new Set<string>()
  for (const css of nuxt.options.css) {
    if (typeof css === 'string') {
      globalCSSPaths.add(normalize(resolveAlias(css, nuxt.options.alias)))
    }
  }
  if (!globalCSSPaths.size) {
    return
  }

  return {
    name: 'nuxt-global-css',
    chunks: 'all' as const,
    enforce: true,
    test: (module: { type: string, identifier: () => string }) => {
      if (module.type !== 'css/mini-extract') { return false }
      const identifier = normalize(module.identifier())
      for (const globalPath of globalCSSPaths) {
        if (identifier.includes(globalPath)) {
          return typeof inlineStyles === 'boolean' ? inlineStyles : inlineStyles(module.identifier())
        }
      }
      return false
    },
  }
}
