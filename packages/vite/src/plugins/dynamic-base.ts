import { createUnplugin } from 'unplugin'
import type { Plugin } from 'vite'

interface DynamicBasePluginOptions {
  env: 'dev' | 'server' | 'client'
  devAppConfig?: Record<string, any>
  globalPublicPath?: string
}

const escapeRE = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

export const RelativeAssetPlugin = function (): Plugin {
  return {
    name: 'nuxt:vite-relative-asset',
    generateBundle (_, bundle) {
      const generatedAssets = Object.entries(bundle).filter(([_, asset]) => asset.type === 'asset').map(([key]) => escapeRE(key))
      const assetRE = new RegExp(`\\/__NUXT_BASE__\\/(${generatedAssets.join('|')})`, 'g')

      for (const file in bundle) {
        const asset = bundle[file]
        if (asset.type === 'asset') {
          const depth = file.split('/').length - 1
          const assetBase = depth === 0 ? '.' : Array.from({ length: depth }).map(() => '..').join('/')
          asset.source = asset.source.toString().replace(assetRE, r => r.replace(/\/__NUXT_BASE__/g, assetBase))
          const publicBase = Array.from({ length: depth + 1 }).map(() => '..').join('/')
          asset.source = asset.source.toString().replace(/\/__NUXT_BASE__/g, publicBase)
        }
      }
    }
  }
}

const VITE_ASSET_RE = /^export default ["'](__VITE_ASSET.*)["']$/

export const DynamicBasePlugin = createUnplugin(function (options: DynamicBasePluginOptions) {
  return {
    name: 'nuxt:dynamic-base-path',
    resolveId (id) {
      if (id.startsWith('/__NUXT_BASE__')) {
        return id.replace('/__NUXT_BASE__', '')
      }
      return null
    },
    enforce: 'post',
    transform (code, id) {
      if (options.globalPublicPath && id.includes('entry.ts')) {
        code = 'import { joinURL } from "ufo";' +
          `${options.globalPublicPath} = joinURL(NUXT_BASE, NUXT_CONFIG.app.buildAssetsDir);` + code
      }

      const assetId = code.match(VITE_ASSET_RE)
      if (assetId) {
        code = 'import { joinURL } from "ufo";' +
          `export default joinURL(NUXT_BASE, NUXT_CONFIG.app.buildAssetsDir, "${assetId[1]}".replace("/__NUXT_BASE__", ""));`
      }

      if (code.includes('NUXT_BASE') && !code.includes('const NUXT_BASE =')) {
        code = 'const NUXT_BASE = NUXT_CONFIG.app.cdnURL || NUXT_CONFIG.app.baseURL;' + code

        if (options.env === 'dev') {
          code = `const NUXT_CONFIG = { app: ${JSON.stringify(options.devAppConfig)} };` + code
        } else if (options.env === 'server') {
          code = 'import NUXT_CONFIG from "#config";' + code
        } else {
          code = 'const NUXT_CONFIG = __NUXT__.config;' + code
        }
      }

      if (id === 'vite/preload-helper') {
        // Define vite base path as buildAssetsUrl (i.e. including _nuxt/)
        code = code.replace(
          /const base = ['"]\/__NUXT_BASE__\/['"]/,
          'import { joinURL } from "ufo";' +
          'const base = joinURL(NUXT_BASE, NUXT_CONFIG.app.buildAssetsDir);')
      }

      // Sanitize imports
      code = code.replace(/from *['"]\/__NUXT_BASE__(\/[^'"]*)['"]/g, 'from "$1"')

      // Dynamically compute string URLs featuring baseURL
      for (const delimiter of ['`', '"', "'"]) {
        const delimiterRE = new RegExp(`${delimiter}([^${delimiter}]*)\\/__NUXT_BASE__\\/([^${delimiter}]*)${delimiter}`, 'g')
        /* eslint-disable-next-line no-template-curly-in-string */
        code = code.replace(delimiterRE, '`$1${NUXT_BASE}$2`')
      }

      return code
    }
  }
})
