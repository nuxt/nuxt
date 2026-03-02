import { resolve } from 'pathe'
import { addBuildPlugin, addComponent, addPlugin, addTemplate, addVitePlugin, defineNuxtModule, directoryToURL } from '@nuxt/kit'
import type { NuxtOptions } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'
import { distDir } from '../dirs.ts'
import { UnheadImportsPlugin } from './plugins/unhead-imports.ts'

const components = ['NoScript', 'Link', 'Base', 'Title', 'Meta', 'Style', 'Head', 'Html', 'Body']

export default defineNuxtModule<NuxtOptions['unhead']>({
  meta: {
    name: 'nuxt:meta',
    configKey: 'unhead',
  },
  setup (options, nuxt) {
    const runtimeDir = resolve(distDir, 'head/runtime')

    // Transpile @unhead/vue
    nuxt.options.build.transpile.push('@unhead/vue')

    // Register components
    const componentsPath = resolve(runtimeDir, 'components')
    for (const componentName of components) {
      addComponent({
        name: componentName,
        filePath: componentsPath,
        export: componentName,
        // built-in that we do not expect the user to override
        priority: 10,
        // kebab case version of these tags is not valid
        kebabName: componentName,
      })
    }

    nuxt.options.alias['#unhead/composables'] = resolve(runtimeDir, 'composables')
    addBuildPlugin(UnheadImportsPlugin({
      sourcemap: !!nuxt.options.sourcemap.server,
      rootDir: nuxt.options.rootDir,
    }))

    // Opt-out feature allowing dependencies using @vueuse/head to work
    const importPaths = nuxt.options.modulesDir.map(d => directoryToURL(d))
    const unheadPlugins = resolveModulePath('@unhead/vue/plugins', { try: true, from: importPaths }) || '@unhead/vue/plugins'

    addTemplate({
      filename: 'unhead-options.mjs',
      getContents () {
        // disableDefaults is enabled to avoid server component issues
        if (!options.legacy) {
          return `
export default {
  disableDefaults: true,
}`
        }
        // v1 unhead legacy options
        const disableCapoSorting = !nuxt.options.experimental.headNext
        return `import { PromisesPlugin, TemplateParamsPlugin, AliasSortingPlugin } from ${JSON.stringify(unheadPlugins)};
export default {
  disableDefaults: true,
  disableCapoSorting: ${Boolean(disableCapoSorting)},
  plugins: [PromisesPlugin, TemplateParamsPlugin, AliasSortingPlugin],
}`
      },
    })

    addTemplate({
      filename: 'unhead.config.mjs',
      getContents () {
        return [
          `export const renderSSRHeadOptions = ${JSON.stringify(options.renderSSRHeadOptions || {})}`,
          `export const ssrStreaming = ${!!(typeof nuxt.options.experimental.ssrStreaming === 'object' && nuxt.options.experimental.ssrStreaming.enabled)}`,
        ].join('\n')
      },
    })

    // template is only exposed in nuxt context, expose in nitro context as well
    nuxt.hooks.hook('nitro:config', (config) => {
      config.virtual!['#internal/unhead-options.mjs'] = () => nuxt.vfs['#build/unhead-options.mjs'] || ''
      config.virtual!['#internal/unhead.config.mjs'] = () => nuxt.vfs['#build/unhead.config.mjs'] || ''
    })

    // SSR streaming: provide IIFE virtual module + emit as minified chunk in production
    // Note: we intentionally do NOT use unheadVuePlugin's SFC transform (HeadStream injection)
    // because it causes hydration mismatches (server renders <script>, client renders null).
    // Instead, the renderer injects head update scripts outside the Vue render tree.
    const ssrStreamingEnabled = typeof nuxt.options.experimental.ssrStreaming === 'object' && nuxt.options.experimental.ssrStreaming.enabled
    if (ssrStreamingEnabled) {
      let iifeChunkFileName: string | undefined

      nuxt.hooks.hook('nitro:config', (config) => {
        config.virtual!['#internal/streaming-iife-chunk.mjs'] = () =>
          `export const iifeChunkFileName = ${JSON.stringify(iifeChunkFileName)}`
      })

      // Vite plugin: provides the IIFE virtual module and emits it as a chunk in production
      addVitePlugin({
        name: 'nuxt:streaming-iife',
        enforce: 'pre',
        applyToEnvironment: (env: any) => env.name === 'client',

        resolveId (id: string) {
          if (id === 'virtual:@unhead/streaming-iife.js') {
            return '\0virtual:@unhead/streaming-iife.js'
          }
        },

        async load (id: string, opts: any) {
          if (id === '\0virtual:@unhead/streaming-iife.js') {
            if (opts?.ssr) { return '' }
            const { streamingIifeCode } = await import('unhead/stream/iife')
            return streamingIifeCode
          }
        },

        buildStart () {
          if (!nuxt.options.dev) {
            this.emitFile({
              type: 'chunk',
              id: 'virtual:@unhead/streaming-iife.js',
              name: 'streaming-iife',
            })
          }
        },

        writeBundle (_options: any, bundle: any) {
          for (const chunk of Object.values(bundle) as any[]) {
            if (chunk.type === 'chunk' && chunk.name === 'streaming-iife') {
              const prefix = nuxt.options.app.buildAssetsDir.replace(/^\//, '')
              let fileName = chunk.fileName as string
              if (fileName.startsWith(prefix)) {
                fileName = fileName.slice(prefix.length)
              }
              iifeChunkFileName = fileName
              break
            }
          }
        },
      })
    }

    // Add library-specific plugin
    addPlugin({ src: resolve(runtimeDir, 'plugins/unhead') })
  },
})
