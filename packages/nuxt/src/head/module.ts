import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import { addBuildPlugin, addComponent, addPlugin, addTemplate, addVitePlugin, defineNuxtModule, directoryToURL, useLogger } from '@nuxt/kit'
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
    const logger = useLogger('nuxt:unhead')
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

    const importPaths = nuxt.options.modulesDir.map(d => directoryToURL(d))

    // Register @unhead/vue/vite plugin for v5 compat mode
    // Vite 8+ ships rolldown and lightningcss as direct deps, so minifiers
    // are always available when using the vite builder. We resolve paths at
    // setup time so dynamic imports resolve from vite's deps, not nuxt's.
    if (nuxt.options.future.compatibilityVersion >= 5 && options.vite !== false) {
      const rolldownPath = resolveModulePath('rolldown/experimental', { try: true, from: importPaths })
      const lightningcssPath = resolveModulePath('lightningcss', { try: true, from: importPaths })
      // Convert to file:// URLs for Windows compatibility with dynamic import()
      const rolldownURL = rolldownPath ? pathToFileURL(rolldownPath).href : undefined
      const lightningcssURL = lightningcssPath ? pathToFileURL(lightningcssPath).href : undefined

      addVitePlugin(async () => {
        const { Unhead } = await import('@unhead/vue/vite')
        const viteOptions = options.vite || {}
        return Unhead({
          validate: !nuxt.options.test,
          minify: {
            js: rolldownURL
              ? async (code) => {
                const { minify } = await import(rolldownURL)
                return (await minify('inline.js', code)).code.trim()
              }
              : undefined,
            css: lightningcssURL
              ? async (code) => {
                const { transform } = await import(lightningcssURL)
                return new TextDecoder().decode(transform({
                  filename: 'inline.css',
                  code: new TextEncoder().encode(code),
                  minify: true,
                }).code).trim()
              }
              : undefined,
          },
          ...viteOptions,
        })
      })
    }

    const unheadLegacy = resolveModulePath('@unhead/vue/legacy', { try: true, from: importPaths }) || '@unhead/vue/legacy'

    addTemplate({
      filename: 'unhead-options.mjs',
      getContents () {
        const isV5 = nuxt.options.future.compatibilityVersion >= 5
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- reading user-facing deprecated option to emit migration warnings
        const legacy = options.legacy
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- reading user-facing deprecated option to emit migration warnings
        const headNext = nuxt.options.experimental.headNext

        if (legacy) {
          if (isV5) {
            logger.warn('`unhead.legacy` is ignored in compatibility version 5+. Remove deprecated head patterns (hid, vmid, children, body:true).')
          } else {
            logger.warn('`unhead.legacy` is deprecated and will be removed. Remove deprecated head patterns (hid, vmid, children, body:true) and migrate promise values to resolved values before passing to useHead.')
          }
        }

        if (headNext === false) {
          logger.warn('`experimental.headNext` is deprecated. CAPO sorting is now the default; set `unhead.legacy: true` to opt out temporarily.')
        }

        const disableCapoSorting = legacy && !isV5 && !headNext

        const lines: string[] = []
        // v4 parity with v2 defaults: restore the plugin set that unhead v3 no
        // longer auto-loads (DeprecationsPlugin, PromisesPlugin, TemplateParamsPlugin,
        // AliasSortingPlugin). v5 users opt in explicitly via their own plugin
        // registration.
        if (!isV5) {
          lines.push(`import { legacyPlugins } from ${JSON.stringify(unheadLegacy)};`)
        }
        lines.push(`export default {`)
        lines.push(`  disableDefaults: true,`)
        if (disableCapoSorting) {
          lines.push(`  disableCapoSorting: true,`)
        }
        if (!isV5) {
          lines.push(`  plugins: legacyPlugins,`)
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
