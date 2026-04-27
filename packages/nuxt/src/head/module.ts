import { createHash } from 'node:crypto'
import { resolve } from 'pathe'
import { addBuildPlugin, addComponent, addPlugin, addTemplate, addVitePlugin, defineNuxtModule, directoryToURL } from '@nuxt/kit'
import type { NuxtOptions } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'
// @ts-expect-error fix type in unhead
import { streamingIifeCode } from 'unhead/stream/iife'
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
        const plugins: string[] = []
        const imports: string[] = []

        if (options.templateParams) {
          imports.push('TemplateParamsPlugin')
          plugins.push('TemplateParamsPlugin')
        }

        if (options.legacy) {
          // v1 unhead legacy options
          for (const name of ['PromisesPlugin', 'AliasSortingPlugin']) {
            if (!imports.includes(name)) {
              imports.push(name)
            }
            plugins.push(name)
          }
          if (!imports.includes('TemplateParamsPlugin')) {
            imports.push('TemplateParamsPlugin')
            plugins.push('TemplateParamsPlugin')
          }
        }

        const disableCapoSorting = options.legacy && !nuxt.options.experimental.headNext

        const lines: string[] = []
        if (imports.length) {
          lines.push(`import { ${imports.join(', ')} } from ${JSON.stringify(unheadPlugins)};`)
        }
        lines.push(`export default {`)
        lines.push(`  disableDefaults: true,`)
        if (disableCapoSorting) {
          lines.push(`  disableCapoSorting: true,`)
        }
        if (plugins.length) {
          lines.push(`  plugins: [${plugins.join(', ')}],`)
        }
        lines.push(`}`)
        return lines.join('\n')
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

    // SSR streaming: emit the unhead streaming IIFE as a raw, content-hashed
    // JS asset in production so the renderer can load it as a classic script
    // (`<script async src>` without `type="module"`). The IIFE is a prebuilt,
    // pre-minified self-invoking string; running it through the bundler's
    // chunk graph would wrap it in ESM and break the loader.
    // Note: we intentionally do NOT use unheadVuePlugin's SFC transform
    // (HeadStream injection) because it causes hydration mismatches (server
    // renders <script>, client renders null). The renderer injects head
    // update scripts outside the Vue render tree.
    const ssrStreamingEnabled = typeof nuxt.options.experimental.ssrStreaming === 'object' && nuxt.options.experimental.ssrStreaming.enabled
    if (ssrStreamingEnabled) {
      let iifeChunkFileName: string | undefined

      nuxt.hooks.hook('nitro:config', (config) => {
        config.virtual!['#internal/streaming-iife-chunk.mjs'] = () =>
          `export const iifeChunkFileName = ${JSON.stringify(iifeChunkFileName)}`
      })

      addVitePlugin({
        name: 'nuxt:streaming-iife-chunk',
        applyToEnvironment: (env: any) => env.name === 'client',

        buildStart () {
          if (nuxt.options.dev) { return }
          const contentHash = createHash('sha256').update(streamingIifeCode).digest('hex').slice(0, 8)
          const baseName = `streaming-iife.${contentHash}.js`
          const prefix = nuxt.options.app.buildAssetsDir.replace(/^\//, '')
          this.emitFile({
            type: 'asset',
            fileName: prefix + baseName,
            source: streamingIifeCode,
          })
          iifeChunkFileName = baseName
        },
      })

      // Webpack/rspack parity: emit the IIFE as a raw asset via
      // `compilation.emitAsset` so it ships as a classic script alongside
      // the chunk graph (no ESM wrapping). Runs only on the client compiler
      // in production — in dev the renderer inlines the IIFE.
      if (!nuxt.options.dev && nuxt.options.builder !== '@nuxt/vite-builder') {
        const makeIifeAssetPlugin = () => ({
          apply (compiler: any) {
            if (compiler.options.name !== 'client') { return }
            compiler.hooks.thisCompilation.tap('nuxt:streaming-iife-chunk', (compilation: any) => {
              const { RawSource } = compiler.webpack.sources
              const { PROCESS_ASSETS_STAGE_ADDITIONAL } = compiler.webpack.Compilation
              compilation.hooks.processAssets.tapPromise(
                { name: 'nuxt:streaming-iife-chunk', stage: PROCESS_ASSETS_STAGE_ADDITIONAL },
                async () => {
                  const contentHash = createHash('sha256').update(streamingIifeCode).digest('hex').slice(0, 8)
                  const fileName = `streaming-iife.${contentHash}.js`
                  if (!compilation.getAsset(fileName)) {
                    compilation.emitAsset(fileName, new RawSource(streamingIifeCode))
                  }
                  iifeChunkFileName = fileName
                },
              )
            })
          },
        })
        addBuildPlugin({
          webpack: makeIifeAssetPlugin,
          rspack: makeIifeAssetPlugin,
        })
      }
    }

    // Add library-specific plugin
    addPlugin({ src: resolve(runtimeDir, 'plugins/unhead') })
  },
})
