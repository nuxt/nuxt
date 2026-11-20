import { resolve } from 'pathe'
import type { Plugin } from 'vite'
import type { Options as VuePluginOptions } from '@vitejs/plugin-vue'
import type { Component, Nuxt } from '@nuxt/schema'
import { getLayerDirectories, runWithNuxtContext } from '@nuxt/kit'
import { isIslandsV2 } from '@nuxt/kit/internal'
import { createSsrLoadClientTransform } from './compiler/ssr-load-client.ts'
import { ssrSlotFallbackTransform } from './compiler/ssr-slot-fallback.ts'
import { type IslandsV2Registry, islandsV2ManifestPlugin } from './manifest.ts'
import { type ComponentIndex, collectSfcFiles, indexComponents } from './scan.ts'
import { islandsV2ScanPlugin } from './scan-plugin.ts'

const SSR_RUNTIME_MODULE = '#app/components/islands-v2/ssr-runtime'
const REGISTRIES = new WeakMap<Nuxt, IslandsV2Registry>()

export function IslandsV2Plugins (nuxt: Nuxt): Plugin[] {
  const islands = nuxt.options.experimental.componentIslands
  if (!isIslandsV2(islands)) {
    return []
  }

  let components: Component[] = Object.values(nuxt.apps).flatMap(app => app.components ?? [])
  let indexed: { components: Component[], index: ComponentIndex } | undefined
  nuxt.hook('components:extend', (extended) => { components = extended })
  const componentIndex = () => {
    if (indexed?.components !== components) { indexed = { components, index: indexComponents(components) } }
    return indexed.index
  }

  const dirs = [...new Set(getLayerDirectories(nuxt).map(layer => resolve(layer.app)))]
  return [
    islandsV2ScanPlugin({
      registry: registryOf(nuxt),
      // `resolveFiles` reads the Nuxt ignore patterns from the Nuxt context.
      collectFiles: () => runWithNuxtContext(nuxt, () => collectSfcFiles(dirs)),
      components: componentIndex,
    }),
    islandsV2ManifestPlugin(registryOf(nuxt), {
      remote: typeof islands === 'object' && islands.remoteIsland ? { dev: nuxt.options.dev, buildAssetsDir: nuxt.options.app.buildAssetsDir } : undefined,
      serverOnlyFiles: () => componentIndex().serverOnlyFiles,
    }),
  ]
}

export function withIslandsV2NodeTransform (nuxt: Nuxt, options: VuePluginOptions = {}): VuePluginOptions {
  if (!isIslandsV2(nuxt.options.experimental.componentIslands)) {
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
        nodeTransforms: [...compilerOptions?.nodeTransforms ?? [], transform, ssrSlotFallbackTransform],
        // Compiled SSR code imports its helpers from this module, which replaces Vue's
        // `ssrRenderTeleport` and `ssrRenderSlot` with ones that write markers.
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
