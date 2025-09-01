import type { NuxtConfigLayer, NuxtOptions } from '@nuxt/schema'
import { useNuxt } from './context'
import { resolve } from 'pathe'

export interface LayerDirectories {
  src: string
  root: string
  server: string
  dir: {
    layouts: string
    middleware: string
    modules: string
    pages: string
    plugins: string
    shared: string
    public: string
  }
}
const layerMap = new WeakMap<NuxtConfigLayer, LayerDirectories>()

export function getLayerDirectories (nuxt = useNuxt()) {
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
      server: withTrailingSlash(resolve(layer.cwd, config?.serverDir || 'server')),
      dir: {
        layouts: withTrailingSlash(resolve(src, config.dir?.layouts || 'layouts')),
        middleware: withTrailingSlash(resolve(src, config.dir?.middleware || 'middleware')),
        pages: withTrailingSlash(resolve(src, config.dir?.pages || 'pages')),
        plugins: withTrailingSlash(resolve(src, config.dir?.plugins || 'plugins')),
        // TODO: consider extracting these from `dir`
        modules: withTrailingSlash(resolve(root, config.dir?.modules || 'modules')),
        shared: withTrailingSlash(resolve(root, config.dir?.shared || 'shared')),
        public: withTrailingSlash(resolve(root, config.dir?.public || 'public')),
      },
    }
    layerMap.set(layer, directories)
    return directories
  })
}

function withTrailingSlash (dir: string) {
  return dir.replace(/[^/]$/, '$&/')
}
