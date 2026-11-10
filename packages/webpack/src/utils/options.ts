import type { Nuxt } from '@nuxt/schema'
import { directoryToURL, resolveAlias } from '@nuxt/kit'
import escapeRegExp from 'escape-string-regexp'
import { resolveModulePath } from 'exsolve'
import { normalize } from 'pathe'

/**
 * Compile-time constants of the Nuxt app for the client or server bundle.
 */
export function getNuxtDefines (nuxt: Nuxt, name: 'client' | 'server'): Record<string, string | boolean> {
  const isClient = name === 'client'
  const isServer = name === 'server'

  const define: Record<string, string | boolean> = {
    '__NUXT_VERSION__': JSON.stringify(nuxt._version),
    '__NUXT_ASYNC_CONTEXT__': nuxt.options.experimental.asyncContext,
    'process.env.VUE_ENV': JSON.stringify(name),
    'process.dev': nuxt.options.dev,
    'process.test': nuxt.options.test,
    'process.browser': isClient,
    'process.client': isClient,
    'process.server': isServer,
    'import.meta.dev': nuxt.options.dev,
    'import.meta.test': nuxt.options.test,
    'import.meta.browser': isClient,
    'import.meta.client': isClient,
    'import.meta.envName': JSON.stringify(nuxt.options.envName),
    'import.meta.server': isServer,
  }

  for (const key of ['prerender', 'nitro']) {
    // wrapped in an IIFE on the server, forcing it to be evaluated at runtime
    define[`process.${key}`] = isClient ? false : `(()=>process.${key})()`
    define[`import.meta.${key}`] = isClient ? false : `(()=>import.meta.${key})()`
  }

  return define
}

/**
 * Pin the packages that hold global vue state (`currentInstance`, reactivity
 * internals, injection keys) to a single resolved entry.
 */
export function resolveVueAliases (nuxt: Nuxt, isServer: boolean): Record<string, string> {
  const aliases: Record<string, string> = {}
  const from = [directoryToURL(nuxt.options.rootDir), directoryToURL(nuxt.options.workspaceDir), import.meta.url]
  const conditions = isServer ? ['node', 'import', 'default'] : ['browser', 'import', 'default']
  for (const pkg of ['@vue/runtime-core', '@vue/runtime-dom', '@vue/reactivity', '@vue/shared', '@vue/runtime-vapor', 'vue-router']) {
    const entry = resolveModulePath(pkg, { from, conditions, try: true })
    if (entry) {
      aliases[`${pkg}$`] = entry
    }
  }
  return aliases
}

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
