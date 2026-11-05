import { resolve } from 'pathe'
import type { Plugin } from 'vite'
import type { Options as VuePluginOptions } from '@vitejs/plugin-vue'
import type { Component, Nuxt } from '@nuxt/schema'
import { getLayerDirectories, runWithNuxtContext } from '@nuxt/kit'
import { createSsrLoadClientTransform } from './compiler/ssr-load-client.ts'
import { type IslandsV2Registry, islandsV2ManifestPlugin } from './manifest.ts'
import { type ScannedImport, collectSfcFiles } from './scan.ts'
import { islandsV2ScanPlugin } from './scan-plugin.ts'

const SSR_RUNTIME_MODULE = '#app/components/islands-v2/ssr-runtime'
const REGISTRIES = new WeakMap<Nuxt, IslandsV2Registry>()

export function IslandsV2Plugins (nuxt: Nuxt): Plugin[] {
  if (nuxt.options.experimental.componentIslands !== 'v2') {
    return []
  }

  const componentImports = new Map<string, ScannedImport>()
  const setComponents = (components: Iterable<Component>) => {
    componentImports.clear()
    for (const component of components) {
      if (!component.pascalName || !component.filePath || component._raw) { continue }
      componentImports.set(component.pascalName, { path: component.filePath, export: component.export || 'default' })
    }
  }
  setComponents(Object.values(nuxt.apps).flatMap(app => app.components ?? []))
  nuxt.hook('components:extend', setComponents)

  const dirs = [...new Set(getLayerDirectories(nuxt).map(layer => resolve(layer.app)))]
  return [
    islandsV2ScanPlugin({
      registry: registryOf(nuxt),
      // `resolveFiles` reads the Nuxt ignore patterns from the context.
      collectFiles: () => runWithNuxtContext(nuxt, () => collectSfcFiles(dirs)),
      additionalImports: () => componentImports,
    }),
    islandsV2ManifestPlugin(registryOf(nuxt)),
  ]
}

export function withIslandsV2NodeTransform (nuxt: Nuxt, options: VuePluginOptions = {}): VuePluginOptions {
  if (nuxt.options.experimental.componentIslands !== 'v2') {
    return options
  }
  const registry = registryOf(nuxt)
  const transform = createSsrLoadClientTransform((file, tag) => registry.components.get(file)?.get(tag))
  const compilerOptions = options.template?.compilerOptions
  return {
    ...options,
    template: {
      ...options.template,
      compilerOptions: {
        ...compilerOptions,
        nodeTransforms: [...compilerOptions?.nodeTransforms ?? [], transform],
        // Swaps `ssrRenderTeleport` for the marker-writing one; see `ssr-runtime.ts`.
        ssrRuntimeModuleName: SSR_RUNTIME_MODULE,
      },
    },
  }
}

/**
 * Registry shared by the plugins and the plugin-vue options of one Nuxt instance.
 */
function registryOf (nuxt: Nuxt): IslandsV2Registry {
  let registry = REGISTRIES.get(nuxt)
  if (!registry) {
    REGISTRIES.set(nuxt, registry = { targets: new Map(), components: new Map() })
  }
  return registry
}
