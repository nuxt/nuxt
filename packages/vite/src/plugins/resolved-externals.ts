import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'
import escapeStringRegexp from 'escape-string-regexp'

export function ResolveExternalsPlugin (nuxt: Nuxt): Plugin {
  let external: Set<string> = new Set()
  return {
    name: 'nuxt:resolve-externals',
    enforce: 'pre',
    config () {
      external = new Set(nuxt['~runtimeDependencies'])

      return {
        optimizeDeps: {
          exclude: Array.from(external),
        },
      }
    },
    applyToEnvironment (environment) {
      if (nuxt.options.dev || environment.name !== 'ssr') {
        return false
      }
      return {
        name: 'nuxt:resolve-externals:external',
        resolveId: {
          filter: {
            id: [...external].map(dep => new RegExp('^' + escapeStringRegexp(dep) + '$')),
          },
          async handler (id, importer) {
            const res = await this.resolve?.(id, importer, { skipSelf: true })
            if (res !== undefined && res !== null) {
              if (res.id === id) {
                res.id = resolveModulePath(res.id, {
                  try: true,
                  from: importer,
                  extensions: nuxt.options.extensions,
                }) || res.id
              }
              return {
                ...res,
                external: 'absolute',
              }
            }
          },
        },
      }
    },
  }
}
