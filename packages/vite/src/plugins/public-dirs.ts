import { existsSync } from 'node:fs'
import { useNitro } from '@nuxt/kit'
import { createUnplugin } from 'unplugin'
import type { UnpluginOptions } from 'unplugin'
import { withLeadingSlash, withTrailingSlash } from 'ufo'
import { dirname, relative } from 'pathe'
import MagicString from 'magic-string'
import { isCSSRequest } from 'vite'

const PREFIX = 'virtual:public?'
const CSS_URL_RE = /url\((\/[^)]+)\)/g
const CSS_URL_SINGLE_RE = /url\(\/[^)]+\)/

interface VitePublicDirsPluginOptions {
  dev?: boolean
  sourcemap?: boolean
  baseURL?: string
}

export const VitePublicDirsPlugin = createUnplugin((options: VitePublicDirsPluginOptions) => {
  const { resolveFromPublicAssets } = useResolveFromPublicAssets()

  const devTransformPlugin: UnpluginOptions = {
    name: 'nuxt:vite-public-dir-resolution-dev',
    vite: {
      transform (code, id) {
        if (!isCSSRequest(id) || !CSS_URL_SINGLE_RE.test(code)) { return }

        const s = new MagicString(code)
        for (const [full, url] of code.matchAll(CSS_URL_RE)) {
          if (url && resolveFromPublicAssets(url)) {
            s.replace(full, `url(${options.baseURL}${url})`)
          }
        }

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap ? s.generateMap({ hires: true }) : undefined,
          }
        }
      },
    },
  }

  return [
    ...(options.dev && options.baseURL && options.baseURL !== '/' ? [devTransformPlugin] : []),
    {
      name: 'nuxt:vite-public-dir-resolution',
      vite: {
        load: {
          enforce: 'pre',
          handler (id) {
            if (id.startsWith(PREFIX)) {
              return `import { publicAssetsURL } from '#internal/nuxt/paths';export default publicAssetsURL(${JSON.stringify(decodeURIComponent(id.slice(PREFIX.length)))})`
            }
          },
        },
        resolveId: {
          enforce: 'post',
          handler (id) {
            if (id === '/__skip_vite' || id[0] !== '/' || id.startsWith('/@fs')) { return }

            if (resolveFromPublicAssets(id)) {
              return PREFIX + encodeURIComponent(id)
            }
          },
        },
        renderChunk (code, chunk) {
          if (!chunk.facadeModuleId?.includes('?inline&used')) { return }

          const s = new MagicString(code)
          const q = code.match(/(?<= = )['"`]/)?.[0] || '"'
          for (const [full, url] of code.matchAll(CSS_URL_RE)) {
            if (url && resolveFromPublicAssets(url)) {
              s.replace(full, `url(${q} + publicAssetsURL(${q}${url}${q}) + ${q})`)
            }
          }

          if (s.hasChanged()) {
            s.prepend(`import { publicAssetsURL } from '#internal/nuxt/paths';`)
            return {
              code: s.toString(),
              map: options.sourcemap ? s.generateMap({ hires: true }) : undefined,
            }
          }
        },
        generateBundle (_outputOptions, bundle) {
          for (const [file, chunk] of Object.entries(bundle)) {
            if (!file.endsWith('.css') || chunk.type !== 'asset') { continue }

            let css = chunk.source.toString()
            let wasReplaced = false
            for (const [full, url] of css.matchAll(CSS_URL_RE)) {
              if (url && resolveFromPublicAssets(url)) {
                const relativeURL = relative(withLeadingSlash(dirname(file)), url)
                css = css.replace(full, `url(${relativeURL})`)
                wasReplaced = true
              }
            }
            if (wasReplaced) {
              chunk.source = css
            }
          }
        },
      },
    },
  ]
})

export function useResolveFromPublicAssets () {
  const nitro = useNitro()

  function resolveFromPublicAssets (id: string) {
    for (const dir of nitro.options.publicAssets) {
      if (!id.startsWith(withTrailingSlash(dir.baseURL || '/'))) { continue }
      const path = id.replace(/[?#].*$/, '').replace(withTrailingSlash(dir.baseURL || '/'), withTrailingSlash(dir.dir))
      if (existsSync(path)) {
        return id
      }
    }
  }

  return { resolveFromPublicAssets }
}
