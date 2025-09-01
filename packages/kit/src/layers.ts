import type { NuxtConfigLayer, NuxtOptions } from '@nuxt/schema'
import { useNuxt } from './context'
import { resolve } from 'pathe'

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
  readonly src: string
  /** Layouts directory (`/app/layouts` by default) */
  readonly layouts: string
  /** Middleware directory (`/app/middleware` by default) */
  readonly middleware: string
  /** Pages directory (`/app/pages` by default) */
  readonly pages: string
  /** Plugins directory (`/app/plugins` by default) */
  readonly plugins: string
}

const layerMap = new WeakMap<NuxtConfigLayer, LayerDirectories>()

export function getLayerDirectories (nuxt = useNuxt()): LayerDirectories[] {
  return nuxt.options._layers.map((layer) => {
    if (layerMap.has(layer)) {
      return layerMap.get(layer)!
    }

    const isRoot = layer.config.rootDir === nuxt.options.rootDir
    const config = isRoot ? nuxt.options : (layer.config as NuxtOptions)

    const src = withTrailingSlash(config.srcDir || layer.cwd)
    const root = withTrailingSlash(config.rootDir || layer.cwd)
    
    const directories = {
      src,
      root,
      shared: withTrailingSlash(resolve(root, config.dir?.shared || 'shared')),
      // these are resolved relative to root in `@nuxt/schema` for v4+
      // so resolving relative to `src` covers backward compatibility for v3
      server: withTrailingSlash(resolve(src, config.serverDir || 'server')),
      modules: withTrailingSlash(resolve(src, config.dir?.modules || 'modules')),
      public: withTrailingSlash(resolve(src, config.dir?.public || 'public')),
      // nuxt app
      layouts: withTrailingSlash(resolve(src, config.dir?.layouts || 'layouts')),
      middleware: withTrailingSlash(resolve(src, config.dir?.middleware || 'middleware')),
      pages: withTrailingSlash(resolve(src, config.dir?.pages || 'pages')),
      plugins: withTrailingSlash(resolve(src, config.dir?.plugins || 'plugins')),
    }
    layerMap.set(layer, directories)
    return directories
  })
}

function withTrailingSlash (dir: string) {
  return dir.replace(/[^/]$/, '$&/')
}
