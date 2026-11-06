import type { Nuxt } from '@nuxt/schema'
import { directoryToURL, resolveAlias } from '@nuxt/kit'
import { parseNodeModulePath } from '@nuxt/kit/internal'
import { resolveModulePath } from 'exsolve'
import { isAbsolute, normalize, resolve } from 'pathe'

const ASSET_RE = /\.(?:css|s[ca]ss|png|jpe?g|gif|svg|woff2?|eot|ttf|otf|webp|webm|mp4|ogv)(?:\?.*)?$/i
const VIRTUAL_RE = /^\0?virtual:(?:nuxt:)?/
const VUE_PACKAGES = new Set(['vue', 'vue/server-renderer', '@vue/server-renderer', '@vue/runtime-dom', '@vue/runtime-core', '@vue/reactivity', '@vue/shared'])

export type ServerExternals = (data: { request?: string, context?: string }, callback: (error?: Error | null, result?: string | boolean) => void) => void

/**
 * Bundle the Nuxt app and its dependencies that need to be transpiled, and leave other dependencies
 * to be resolved (and traced) by Nitro.
 */
export function createServerExternals (nuxt: Nuxt, options: { inline?: string[] } = {}): ServerExternals {
  const inline = [
    'src/',
    '#app',
    'nuxt',
    'nuxt3',
    'nuxt-nightly',
    '!',
    '-!',
    '~',
    '@/',
    '#',
    ...options.inline || [],
    ...nuxt.options.build.transpile.filter((pattern): pattern is string => typeof pattern === 'string'),
  ]

  const external = new Set([
    'nitro/runtime-config',
    // TODO: remove in v5
    '#internal/nitro',
    'nitropack/runtime',
    '#shared',
    resolve(nuxt.options.rootDir, nuxt.options.dir.shared),
    ...VUE_PACKAGES,
    ...nuxt['~runtimeDependencies'] || [],
  ])
  if (!nuxt.options.dev) {
    external.add('#internal/nuxt/paths')
    external.add('#internal/nuxt/app-config')
    external.add('#app-manifest')
  }

  const conditions = [
    nuxt.options.dev ? 'development' : 'production',
    'node',
    'import',
    'require',
  ]

  return ({ request, context }, callback) => {
    if (!request) {
      return callback(undefined, false)
    }
    if (external.has(request)) {
      // Resolve to absolute path so nitro can handle version resolution
      const resolved = resolveModulePath(VUE_PACKAGES.has(request) ? resolveAlias(request, nuxt.options.alias) : request, {
        from: (context ? [context, ...nuxt.options.modulesDir] : nuxt.options.modulesDir).map(d => directoryToURL(d)),
        suffixes: ['', 'index'],
        conditions,
        try: true,
      })
      return callback(undefined, resolved && isAbsolute(resolved) ? resolved : true)
    }
    if (
      request[0] === '.' ||
      isAbsolute(request) ||
      inline.some(prefix => request.startsWith(prefix)) ||
      ASSET_RE.test(request)
    ) {
      return callback(undefined, false)
    }

    if (context && !request.startsWith('node:') && (isAbsolute(context) || VIRTUAL_RE.test(context))) {
      try {
        const normalisedRequest = resolveAlias(normalize(request), nuxt.options.alias)
        const dir = parseNodeModulePath(context).dir || nuxt.options.rootDir

        const resolved = resolveModulePath(normalisedRequest, {
          from: [dir, ...nuxt.options.modulesDir].map(d => directoryToURL(d)),
          suffixes: ['', 'index'],
          conditions,
          try: true,
        })

        if (resolved && isAbsolute(resolved)) {
          return callback(undefined, false)
        }
      } catch {
        // Ignore resolution errors, fall through to externalize
      }
    }

    return callback(undefined, true)
  }
}
