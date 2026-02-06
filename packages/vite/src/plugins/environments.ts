import type { InlineConfig, Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { withoutLeadingSlash } from 'ufo'
import type { OutputOptions } from 'rolldown'
import { dirname, isAbsolute, join, relative, resolve } from 'pathe'
import { useNitro } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { defineEnv } from 'unenv'
import escapeStringRegexp from 'escape-string-regexp'

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

  let viteConfig: InlineConfig

  return {
    name: 'nuxt:environments',
    enforce: 'pre', // run before other plugins
    config (config) {
      viteConfig = config
      if (!nuxt.options.dev) {
        return {
          base: './',
        }
      }
    },
    configEnvironment (name, config) {
      if (!nuxt.options.experimental.viteEnvironmentApi && viteConfig.ssr) {
        config.optimizeDeps ||= {}
        config.optimizeDeps.include = undefined
      }
      if (name === 'client') {
        const outputConfig = config.build?.rolldownOptions?.output as OutputOptions | undefined
        return {
          build: {
            rolldownOptions: {
              output: {
                chunkFileNames: outputConfig?.chunkFileNames ?? (nuxt.options.dev ? undefined : fileNames),
                entryFileNames: outputConfig?.entryFileNames ?? (nuxt.options.dev ? 'entry.js' : fileNames),
                sourcemapPathTransform: outputConfig?.sourcemapPathTransform ?? ((relativeSourcePath, sourcemapPath) => {
                  // client build is running in a temporary build directory, like `.nuxt/dist/client`
                  // so we need to transform the sourcemap path to be relative to the final build directory
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
        // Disable manual chunks and advancedChunks for SSR environment to avoid splitting issues
        if (config.build?.rolldownOptions?.output && !Array.isArray(config.build.rolldownOptions.output)) {
          delete config.build.rolldownOptions.output.manualChunks
          delete config.build.rolldownOptions.output.advancedChunks
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
            resolveId: {
              filter: {
                id: Object.keys(clientAliases).map(id => new RegExp('^' + escapeStringRegexp(id) + '$')),
              },
              handler: source => clientAliases[source],
            },
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
