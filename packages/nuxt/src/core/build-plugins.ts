import { join } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { addBuildPlugin } from '@nuxt/kit'
import { resolveVuePackages } from '@nuxt/kit/internal'
import type { Unimport } from 'unimport'
import type { Nuxt } from 'nuxt/schema'

import { toArray } from '../utils.ts'
import { addImportProtectionPlugins } from './plugins/import-protection.ts'
import { UnctxTransformPlugin } from './plugins/unctx.ts'
import { TreeShakeComposablesPlugin } from './plugins/tree-shake.ts'
import { DevOnlyPlugin } from './plugins/dev-only.ts'
import { LayerAliasingPlugin } from './plugins/layer-aliasing.ts'
import { RemovePluginMetadataPlugin } from './plugins/plugin-metadata.ts'
import { AsyncContextInjectionPlugin } from './plugins/async-context.ts'
import { PrehydrateTransformPlugin } from './plugins/prehydrate.ts'
import { ExtractAsyncDataHandlersPlugin } from './plugins/extract-async-data-handlers.ts'
import { VirtualFSPlugin } from './plugins/virtual.ts'
import { BundledVuePlugin } from './plugins/bundled-vue.ts'
import { VuePackagesBundlerPlugin, VuePackagesPlugin } from './plugins/vue-packages.ts'

/**
 * Register the transforms core Nuxt applies to app code. Those that depend on options modules
 * may still change are registered once modules are done.
 */
export function addCoreBuildPlugins (nuxt: Nuxt) {
  const vuePackages = resolveVuePackages(nuxt)
  addBuildPlugin({
    vite: () => VuePackagesPlugin(vuePackages),
    webpack: () => VuePackagesBundlerPlugin(vuePackages),
    rspack: () => VuePackagesBundlerPlugin(vuePackages),
  })
  nuxt.hook('nitro:config', (config) => {
    config.rollupConfig ||= {}
    config.rollupConfig.plugins = [VuePackagesPlugin(vuePackages), ...toArray(config.rollupConfig.plugins || [])]
  })

  if (!nuxt.options.dev && !nuxt.options.vue.runtimeCompiler) {
    addBuildPlugin({ vite: () => BundledVuePlugin() }, { client: false })
    nuxt.hook('nitro:config', (config) => {
      config.rollupConfig ||= {}
      config.rollupConfig.plugins = [...toArray(config.rollupConfig.plugins || []), BundledVuePlugin()]
    })
  }

  addBuildPlugin(VirtualFSPlugin(nuxt, { mode: 'server' }), { client: false })
  addBuildPlugin(VirtualFSPlugin(nuxt, {
    mode: 'client',
    alias: {
      '#internal/nitro': join(nuxt.options.buildDir, 'nitro.client.mjs'),
      'nitro/runtime-config': join(nuxt.options.buildDir, 'nitro.client.mjs'),
      'nitropack/runtime': join(nuxt.options.buildDir, 'nitro.client.mjs'),
    },
  }), { server: false })

  addBuildPlugin(RemovePluginMetadataPlugin(nuxt, 'server'), { client: false })
  addBuildPlugin(RemovePluginMetadataPlugin(nuxt, 'client'), { server: false })

  addBuildPlugin(PrehydrateTransformPlugin())

  if (nuxt.options.experimental.localLayerAliases) {
    addBuildPlugin(LayerAliasingPlugin({
      dev: nuxt.options.dev,
      root: nuxt.options.srcDir,
      // the project's own aliases already resolve correctly
      layers: nuxt.options._layers.slice(1),
    }))
  }

  let importsContext: Unimport | undefined
  nuxt.hook('imports:context', (ctx) => { importsContext = ctx })

  nuxt.hook('modules:done', () => {
    if (nuxt.options.experimental.asyncContext) {
      addBuildPlugin(AsyncContextInjectionPlugin(), { client: false })
    }

    // server-only: the `executeAsync` wrappers restore context across `await`, which a
    // browser's set-once Nuxt app does not need
    addBuildPlugin(UnctxTransformPlugin({
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
      transformerOptions: {
        ...nuxt.options.optimization.asyncTransforms,
        helperModule: resolveModulePath('unctx', { from: import.meta.url, try: true }) ?? 'unctx',
      },
    }), { client: false })

    const getAutoImports = () => importsContext?.getImportMap()
    const { server, client } = nuxt.options.optimization.treeShake.composables
    if (Object.keys(server).length) {
      addBuildPlugin(TreeShakeComposablesPlugin({ composables: server, getAutoImports }), { client: false })
    }
    if (Object.keys(client).length) {
      addBuildPlugin(TreeShakeComposablesPlugin({
        composables: client,
        getAutoImports,
        stubs: { onServerPrefetch: '#app/composables/server-prefetch' },
      }), { server: false })
    }

    if (!nuxt.options.test) {
      addImportProtectionPlugins(nuxt)
    }
  })

  if (!nuxt.options.dev) {
    addBuildPlugin(DevOnlyPlugin())

    if (nuxt.options.experimental.extractAsyncDataHandlers) {
      addBuildPlugin(ExtractAsyncDataHandlersPlugin({
        sourcemap: !!nuxt.options.sourcemap.client,
        rootDir: nuxt.options.rootDir,
        appDir: nuxt.options.appDir,
      }), { server: false })
    }
  }
}
