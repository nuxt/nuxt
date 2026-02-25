import { resolve } from 'pathe'
import { addBuildPlugin, addComponent, addPlugin, addTemplate, defineNuxtModule, directoryToURL } from '@nuxt/kit'
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

    // allow @unhead/vue server composables to be tree-shaken from the client bundle
    if (!nuxt.options.dev) {
      nuxt.options.optimization.treeShake.composables.client['@unhead/vue'] = [
        'useServerHead', 'useServerSeoMeta', 'useServerHeadSafe',
      ]
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
        return `import { DeprecationsPlugin, PromisesPlugin, TemplateParamsPlugin, AliasSortingPlugin } from ${JSON.stringify(unheadPlugins)};
export default {
  disableDefaults: true,
  disableCapoSorting: ${Boolean(disableCapoSorting)},
  plugins: [DeprecationsPlugin, PromisesPlugin, TemplateParamsPlugin, AliasSortingPlugin],
}`
      },
    })

    addTemplate({
      filename: 'unhead.config.mjs',
      getContents () {
        return [
          `export const renderSSRHeadOptions = ${JSON.stringify(options.renderSSRHeadOptions || {})}`,
        ].join('\n')
      },
    })

    // template is only exposed in nuxt context, expose in nitro context as well
    nuxt.hooks.hook('nitro:config', (config) => {
      config.virtual!['#internal/unhead-options.mjs'] = () => nuxt.vfs['#build/unhead-options.mjs'] || ''
      config.virtual!['#internal/unhead.config.mjs'] = () => nuxt.vfs['#build/unhead.config.mjs'] || ''
    })

    // Add library-specific plugin
    addPlugin({ src: resolve(runtimeDir, 'plugins/unhead') })
  },
})
