import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { withoutLeadingSlash } from 'ufo'
import * as vite from 'vite'
import { dirname, isAbsolute, join, relative, resolve } from 'pathe'
import { useNitro } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { defineEnv } from 'unenv'
import { clientEnvironment } from '../shared/client'

export function EnvironmentsPlugin (nuxt: Nuxt): Plugin {
  const fileNames = withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, '[hash].js'))
  const clientOutputDir = join(useNitro().options.output.publicDir, nuxt.options.app.buildAssetsDir)

  const clientAliases: Record<string, string> = {
    'nitro/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs'),
    // TODO: remove in v5
    '#internal/nitro': join(nuxt.options.buildDir, 'nitro.client.mjs'),
    'nitropack/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs'),
    // work around vite optimizer bug
    '#app-manifest': resolveModulePath('mocked-exports/empty', { from: import.meta.url }),
  }

  return {
    name: 'nuxt:environments',
    config () {
      if (!nuxt.options.dev) {
        return {
          base: './',
        }
      }
    },
    configEnvironment (name, config) {
      if (name === 'client') {
        // Extract entry point for clientEnvironment configuration
        const input = config.build?.rollupOptions?.input
        const entry = typeof input === 'object' && input !== null && !Array.isArray(input)
          ? (input as Record<string, string>).entry || ''
          : typeof input === 'string' ? input : ''

        // Get client environment configuration including optimizeDeps
        const clientEnv = clientEnvironment(nuxt, entry)

        // Explicitly set optimizeDeps from client environment configuration
        // This is necessary because optimizeDeps is not inherited by environments
        // See: https://vite.dev/guide/api-environment
        config.optimizeDeps = clientEnv.optimizeDeps

        const outputConfig = config.build?.rollupOptions?.output as vite.Rollup.OutputOptions

        return {
          build: {
            rollupOptions: {
              output: {
                chunkFileNames: outputConfig?.chunkFileNames ?? (nuxt.options.dev ? undefined : fileNames),
                entryFileNames: outputConfig?.entryFileNames ?? (nuxt.options.dev ? 'entry.js' : fileNames),
                sourcemapPathTransform: outputConfig?.sourcemapPathTransform ?? ((relativeSourcePath, sourcemapPath) => {
                  if (!isAbsolute(relativeSourcePath)) {
                    const absoluteSourcePath = resolve(dirname(sourcemapPath), relativeSourcePath)
                    return relative(clientOutputDir, absoluteSourcePath)
                  }
                  return relativeSourcePath
                }),
              },
            },
          },
        }
      }

      if (name === 'ssr') {
        // Disable manual chunks for SSR environment to avoid splitting issues
        if (config.build?.rollupOptions?.output && !Array.isArray(config.build.rollupOptions.output)) {
          config.build.rollupOptions.output.manualChunks = undefined

          // Also disable advancedChunks when using Rolldown
          if ((vite as any).rolldownVersion) {
            (config.build.rollupOptions.output as any).advancedChunks = undefined
          }
        }
      }
    },
    applyToEnvironment (environment) {
      if (environment.name === 'client') {
        return [
          ...nuxt.options.experimental.clientNodeCompat ? [NodeCompatAliasPlugin()] : [],
          {
            name: 'nuxt:client:aliases',
            enforce: 'post',
            resolveId: source => clientAliases[source],
          },
        ]
      } else if (environment.name === 'ssr') {
        //
      }
      return false
    },
  }
}

function NodeCompatAliasPlugin (): Plugin {
  const nodeCompatAlias = defineEnv({ nodeCompat: true, resolve: true }).env.alias
  return {
    name: 'nuxt:client:node-compat-aliases',
    resolveId: {
      order: 'pre',
      handler (source) {
        if (source in nodeCompatAlias) {
          return nodeCompatAlias[source]
        }
      },
    },
  }
}
