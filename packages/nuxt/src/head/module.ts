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
          if (nuxt.options.future.compatibilityVersion >= 5) {
            console.warn('[nuxt] [unhead] `unhead.legacy` is ignored in compatibility version 5+. Remove deprecated head patterns (hid, vmid, children, body:true).')
          } else {
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
        }

        // ValidatePlugin: dev only, disabled during testing
        if (options.validate && nuxt.options.dev && !nuxt.options.test) {
          imports.push('ValidatePlugin')
          plugins.push('ValidatePlugin()')
        }

        // CanonicalPlugin
        if (options.canonical) {
          imports.push('CanonicalPlugin')
          const canonicalOpts = typeof options.canonical === 'object'
            ? JSON.stringify(options.canonical)
            : '{}'
          plugins.push(`CanonicalPlugin(${canonicalOpts})`)
        }

        // MinifyPlugin: production only
        if (options.minify && !nuxt.options.dev) {
          imports.push('MinifyPlugin')
          plugins.push('MinifyPlugin()')
        }

        const disableCapoSorting = options.legacy && nuxt.options.future.compatibilityVersion < 5 && !nuxt.options.experimental.headNext

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
        ].join('\n')
      },
    })

    // template is only exposed in nuxt context, expose in nitro context as well
    nuxt.hooks.hook('nitro:config', (config) => {
      config.virtual!['#internal/unhead-options.mjs'] = () => nuxt.vfs['#build/unhead-options.mjs'] || ''
      config.virtual!['#internal/unhead.config.mjs'] = () => nuxt.vfs['#build/unhead.config.mjs'] || ''
    })

    // Remove deprecated server composables from auto-imports in v5
    if (nuxt.options.future.compatibilityVersion >= 5) {
      const deprecated = new Set(['useServerHead', 'useServerHeadSafe', 'useServerSeoMeta'])
      nuxt.hooks.hook('imports:sources', (sources) => {
        for (const source of sources) {
          if ('from' in source && source.from === '#app/composables/head' && 'imports' in source && Array.isArray(source.imports)) {
            source.imports = (source.imports as (string | { name: string })[]).filter(
              i => !deprecated.has(typeof i === 'string' ? i : i.name),
            )
          }
        }
      })
    }

    // Add library-specific plugin
    addPlugin({ src: resolve(runtimeDir, 'plugins/unhead') })
  },
})
