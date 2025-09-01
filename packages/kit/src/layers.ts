import type { NuxtConfigLayer, NuxtOptions } from '@nuxt/schema'
import { useNuxt } from './context'
import { resolve } from 'pathe'

export interface LayerDirectories {
  srcDir: string
  rootDir: string
  serverDir: string
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

    const srcDir = withTrailingSlash(config.srcDir || layer.cwd)
    const rootDir = withTrailingSlash(config.rootDir || layer.cwd)
    const directories = {
      srcDir,
      rootDir,
      serverDir: withTrailingSlash(resolve(layer.cwd, config?.serverDir || 'server')),
      dir: {
        layouts: withTrailingSlash(resolve(srcDir, config.dir?.layouts || 'layouts')),
        middleware: withTrailingSlash(resolve(srcDir, config.dir?.middleware || 'middleware')),
        pages: withTrailingSlash(resolve(srcDir, config.dir?.pages || 'pages')),
        plugins: withTrailingSlash(resolve(srcDir, config.dir?.plugins || 'plugins')),
        // TODO: consider extracting these from `dir`
        modules: withTrailingSlash(resolve(rootDir, config.dir?.modules || 'modules')),
        shared: withTrailingSlash(resolve(rootDir, config.dir?.shared || 'shared')),
        public: withTrailingSlash(resolve(rootDir, config.dir?.public || 'public')),
      },
    }
    layerMap.set(layer, directories)
    return directories
  })
}

function withTrailingSlash (dir: string) {
  return dir.replace(/[^/]$/, '$&/')
}
