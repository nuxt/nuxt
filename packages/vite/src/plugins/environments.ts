import type { BuildOptions, Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { withoutLeadingSlash } from 'ufo'
import defu from 'defu'
import { join } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { defineEnv } from 'unenv'
import { resolveAlias } from 'pathe/utils'

export function EnvironmentsPlugin (nuxt: Nuxt): Plugin[] {
  const clientAlias = {
    // user aliases
    ...nuxt.options.experimental.clientNodeCompat ? defineEnv({ nodeCompat: true, resolve: true }).env.alias : {},
    // TODO:?
    // ...config.resolve?.alias,
    'nitro/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs'),
    // work around vite optimizer bug
    '#app-manifest': resolveModulePath('mocked-exports/empty', { from: import.meta.url }),
  }
  return [
    {
      name: 'nuxt:environments',
      config (config) {
        if (config.optimizeDeps?.include && config.optimizeDeps?.exclude) {
          const exclude = new Set(config.optimizeDeps.exclude)
          config.optimizeDeps.include = config.optimizeDeps.include.filter(dep => !exclude.has(dep))
        }
      },
      applyToEnvironment (environment) {
        const alias = environment.name === 'client' ? clientAlias : {}
        return {
          name: `nuxt:resolve:${environment.name}`,
          enforce: 'pre',
          resolveId: {
            order: 'pre',
            handler (source, importer, options) {
              const value = resolveAlias(source, alias)
              if (value !== source) {
                return this.resolve(value, importer, { ...options, skipSelf: true })
              }
            },
          },

        }
      },
      async configEnvironment (name, config) {
        // Prioritize `optimizeDeps.exclude`. If same dep is in `include` and `exclude`, remove it from `include`
        const exclude = new Set([...config.optimizeDeps?.exclude || [], ...config.optimizeDeps?.exclude || []])
        if (exclude.size > 0 && config.optimizeDeps?.include) {
          config.optimizeDeps.include = config.optimizeDeps.include.filter(dep => !exclude.has(dep))
        }

        if (name === 'client') {
          // We want to respect users' own rollup output options
          const fileNames = withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, '[hash].js'))
          config.build ||= {}
          config.build.rollupOptions = defu(config.build.rollupOptions satisfies BuildOptions['rollupOptions'], {
            output: {
              chunkFileNames: nuxt.options.dev ? undefined : fileNames,
              entryFileNames: nuxt.options.dev ? 'entry.js' : fileNames,
            } satisfies NonNullable<BuildOptions['rollupOptions']>['output'],
          }) as BuildOptions['rollupOptions']
        } else if (config.build?.rollupOptions?.output && !Array.isArray(config.build.rollupOptions.output)) {
          delete config.build.rollupOptions.output.manualChunks
        }

        await nuxt.callHook('vite:extendConfig', config, { isClient: name === 'client', isServer: name === 'ssr' })
      },
      async configResolved (config) {
        await nuxt.callHook('vite:configResolved', config, { isClient: true, isServer: true })
      },
    },
  ]
}
