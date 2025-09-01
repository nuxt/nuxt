import type { NuxtConfigLayer, NuxtOptions } from '@nuxt/schema'
import { normalize, resolve } from 'pathe'

import { useNuxt } from './context'
import { resolveAlias } from './resolve'

export interface LayerDirectories {
  /** Nuxt rootDir (`/` by default) */
  readonly root: string
  /** Nitro source directory (`/server` by default) */
  readonly server: string
  /** Local modules directory (`/modules` by default) */
  readonly modules: string
  /** Shared directory (`/shared` by default) */
  readonly shared: string
  /** Public directory (`/public` by default) */
  readonly public: string
  /** Nuxt srcDir (`/app/` by default) */
  readonly app: string
  /** Layouts directory (`/app/layouts` by default) */
  readonly appLayouts: string
  /** Middleware directory (`/app/middleware` by default) */
  readonly appMiddleware: string
  /** Pages directory (`/app/pages` by default) */
  readonly appPages: string
  /** Plugins directory (`/app/plugins` by default) */
  readonly appPlugins: string
}

const layerMap = new WeakMap<NuxtConfigLayer, LayerDirectories>()

/**
 * Get the resolved directory paths for all layers in a Nuxt application.
 *
 * Returns an array of LayerDirectories objects, ordered by layer priority:
 * - The first layer is the user/project layer (highest priority)
 * - Earlier layers override later layers in the array
 * - Base layers appear last in the array (lowest priority)
 *
 * @param nuxt - The Nuxt instance to get layers from. Defaults to the current Nuxt context.
 * @returns Array of LayerDirectories objects, ordered by priority (user layer first)
 */
export function getLayerDirectories (nuxt = useNuxt()): LayerDirectories[] {
  return nuxt.options._layers.map((layer) => {
    if (layerMap.has(layer)) {
      return layerMap.get(layer)!
    }

    const isRoot = normalize(layer.config.rootDir) === normalize(nuxt.options.rootDir)
    const config = isRoot ? nuxt.options : (layer.config as NuxtOptions)

    const src = withTrailingSlash(config.srcDir || layer.cwd)
    const root = withTrailingSlash(config.rootDir || layer.cwd)

    const directories = {
      root,
      shared: withTrailingSlash(resolve(root, resolveAlias(config.dir?.shared || 'shared', nuxt.options.alias))),
      // these are resolved relative to root in `@nuxt/schema` for v4+
      // so resolving relative to `src` covers backward compatibility for v3
      server: withTrailingSlash(resolve(src, resolveAlias(config.serverDir || 'server', nuxt.options.alias))),
      modules: withTrailingSlash(resolve(src, resolveAlias(config.dir?.modules || 'modules', nuxt.options.alias))),
      public: withTrailingSlash(resolve(src, resolveAlias(config.dir?.public || 'public', nuxt.options.alias))),
      // nuxt app
      app: src,
      appLayouts: withTrailingSlash(resolve(src, resolveAlias(config.dir?.layouts || 'layouts', nuxt.options.alias))),
      appMiddleware: withTrailingSlash(resolve(src, resolveAlias(config.dir?.middleware || 'middleware', nuxt.options.alias))),
      appPages: withTrailingSlash(resolve(src, resolveAlias(config.dir?.pages || 'pages', nuxt.options.alias))),
      appPlugins: withTrailingSlash(resolve(src, resolveAlias(config.dir?.plugins || 'plugins', nuxt.options.alias))),
    }
    layerMap.set(layer, directories)
    return directories
  })
}

function withTrailingSlash (dir: string) {
  return dir.replace(/[^/]$/, '$&/')
}
