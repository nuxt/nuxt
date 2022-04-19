import { createUnplugin } from 'unplugin'
import escapeRE from 'escape-string-regexp'
import type { Plugin } from 'vite'
import MagicString from 'magic-string'

interface DynamicBasePluginOptions {
  globalPublicPath?: string
}

export const RelativeAssetPlugin = function (): Plugin {
  return {
    name: 'nuxt:vite-relative-asset',
    generateBundle (_, bundle) {
      const generatedAssets = Object.entries(bundle).filter(([_, asset]) => asset.type === 'asset').map(([key]) => escapeRE(key))
      const assetRE = new RegExp(`\\/__NUXT_BASE__\\/(${generatedAssets.join('|')})`, 'g')

      for (const file in bundle) {
        const asset = bundle[file]
        if (asset.fileName.includes('legacy') && asset.type === 'chunk' && asset.code.includes('innerHTML')) {
          for (const delimiter of ['`', '"', "'"]) {
            asset.code = asset.code.replace(
              new RegExp(`(?<=innerHTML=)${delimiter}([^${delimiter}]*)\\/__NUXT_BASE__\\/([^${delimiter}]*)${delimiter}`, 'g'),
              /* eslint-disable-next-line no-template-curly-in-string */
              '`$1${(window?.__NUXT__?.config.app.cdnURL || window?.__NUXT__?.config.app.baseURL) + window?.__NUXT__?.config.app.buildAssetsDir.slice(1)}$2`'
            )
          }
        }
        if (asset.type === 'asset' && typeof asset.source === 'string' && asset.fileName.endsWith('.css')) {
          const depth = file.split('/').length - 1
          const assetBase = depth === 0 ? '.' : Array.from({ length: depth }).map(() => '..').join('/')
          const publicBase = Array.from({ length: depth + 1 }).map(() => '..').join('/')
          asset.source = asset.source
            .replace(assetRE, r => r.replace(/\/__NUXT_BASE__/g, assetBase))
            .replace(/\/__NUXT_BASE__/g, publicBase)
        }
        if (asset.type === 'chunk' && typeof asset.code === 'string') {
          asset.code = asset.code
            .replace(/`\$\{(_?_?publicAssetsURL|buildAssetsURL|)\(\)\}([^`]*)`/g, '$1(`$2`)')
            .replace(/"\/__NUXT_BASE__\/([^"]*)"\.replace\("\/__NUXT_BASE__", ""\)/g, '"$1"')
            .replace(/'\/__NUXT_BASE__\/([^']*)'\.replace\("\/__NUXT_BASE__", ""\)/g, '"$1"')
        }
      }
    }
  }
}

const VITE_ASSET_RE = /^export default ["'](__VITE_ASSET.*)["']$/

export const DynamicBasePlugin = createUnplugin(function (options: DynamicBasePluginOptions = {}) {
  return {
    name: 'nuxt:dynamic-base-path',
    resolveId (id) {
      if (id.startsWith('/__NUXT_BASE__')) {
        return id.replace('/__NUXT_BASE__', '')
      }
      if (id === '#internal/nitro') { return '#internal/nitro' }
      return null
    },
    enforce: 'post',
    transform (code, id) {
      const s = new MagicString(code)

      if (options.globalPublicPath && id.includes('paths.mjs') && code.includes('const appConfig = ')) {
        s.append(`${options.globalPublicPath} = buildAssetsURL();\n`)
      }

      const assetId = code.match(VITE_ASSET_RE)
      if (assetId) {
        s.overwrite(0, code.length,
          [
            'import { buildAssetsURL } from \'#build/paths.mjs\';',
            `export default buildAssetsURL("${assetId[1]}".replace("/__NUXT_BASE__", ""));`
          ].join('\n')
        )
      }

      if (!id.includes('paths.mjs') && code.includes('NUXT_BASE') && !code.includes('import { publicAssetsURL as __publicAssetsURL }')) {
        s.prepend('import { publicAssetsURL as __publicAssetsURL } from \'#build/paths.mjs\';\n')
      }

      if (id === 'vite/preload-helper') {
        // Define vite base path as buildAssetsUrl (i.e. including _nuxt/)
        s.prepend('import { buildAssetsDir } from \'#build/paths.mjs\';\n')
        s.replace(/const base = ['"]\/__NUXT_BASE__\/['"]/, 'const base = buildAssetsDir()')
      }

      // Sanitize imports
      s.replace(/from *['"]\/__NUXT_BASE__(\/[^'"]*)['"]/g, 'from "$1"')

      // Dynamically compute string URLs featuring baseURL
      for (const delimiter of ['`', "'", '"']) {
        const delimiterRE = new RegExp(`(?<!(const base = |from *))${delimiter}([^${delimiter}]*)\\/__NUXT_BASE__\\/([^${delimiter}]*)${delimiter}`, 'g')
        /* eslint-disable-next-line no-template-curly-in-string */
        s.replace(delimiterRE, r => '`' + r.replace(/\/__NUXT_BASE__\//g, '${__publicAssetsURL()}').slice(1, -1) + '`')
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: s.generateMap({ source: id, includeContent: true })
        }
      }
    }
  }
})
