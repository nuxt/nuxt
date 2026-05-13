import { existsSync } from 'node:fs'
import { useNitro } from '@nuxt/kit'
import { withLeadingSlash, withTrailingSlash } from 'ufo'
import { dirname, relative } from 'pathe'
import { generateTransform, rolldownString } from 'rolldown-string'
import { isCSSRequest } from 'vite'
import type { Plugin } from 'vite'

const PREFIX = 'virtual:public?'
const PREFIX_RE = /^virtual:public\?/
const CSS_URL_RE = /url\((\/[^)]+)\)/g
const CSS_URL_SINGLE_RE = /url\(\/[^)]+\)/
const RENDER_CHUNK_RE = /(?<= = )['"`]/

interface VitePublicDirsPluginOptions {
  dev?: boolean
  baseURL?: string
}

export const PublicDirsPlugin = (options: VitePublicDirsPluginOptions): Plugin[] => {
  const { resolveFromPublicAssets } = useResolveFromPublicAssets()

  return [
    {
      name: 'nuxt:vite-public-dir-resolution-dev',
      apply () {
        return !!options.dev && !!options.baseURL && options.baseURL !== '/'
      },
      transform (code, id, meta?: unknown) {
        if (!isCSSRequest(id) || !CSS_URL_SINGLE_RE.test(code)) { return }

        const s = rolldownString(code, id, meta)
        for (const [full, url] of code.matchAll(CSS_URL_RE)) {
          if (url && resolveFromPublicAssets(url)) {
            s.replace(full, `url(${options.baseURL}${url})`)
          }
        }

        return generateTransform(s, id)
      },
    },
    {
      name: 'nuxt:vite-public-dir-resolution',
      load: {
        order: 'pre',
        filter: {
          id: PREFIX_RE,
        },
        handler (id) {
          return `import { publicAssetsURL } from '#internal/nuxt/paths';export default publicAssetsURL(${JSON.stringify(decodeURIComponent(id.slice(PREFIX.length)))})`
        },
      },
      resolveId: {
        order: 'post',
        filter: {
          id: {
            exclude: [/^\/__skip_vite$/, /^[^/]/, /^\/@fs/],
          },
        },
        handler (id) {
          if (resolveFromPublicAssets(id)) {
            return PREFIX + encodeURIComponent(id)
          }
        },
      },
      renderChunk (code, chunk) {
        if (!chunk.facadeModuleId?.includes('?inline&used')) { return }

        const s = rolldownString(code, chunk.fileName)
        const q = code.match(RENDER_CHUNK_RE)?.[0] || '"'
        for (const [full, url] of code.matchAll(CSS_URL_RE)) {
          if (url && resolveFromPublicAssets(url)) {
            s.replace(full, `url(${q} + publicAssetsURL(${q}${url}${q}) + ${q})`)
          }
        }

        if (s.hasChanged()) {
          s.prepend(`import { publicAssetsURL } from '#internal/nuxt/paths';`)
        }
        return generateTransform(s, chunk.fileName)
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
  ]
}

const PUBLIC_ASSETS_RE = /[?#].*$/
export function useResolveFromPublicAssets () {
  const nitro = useNitro()

  function resolveFromPublicAssets (id: string) {
    for (const dir of nitro.options.publicAssets) {
      if (!id.startsWith(withTrailingSlash(dir.baseURL || '/'))) { continue }
      const path = id.replace(PUBLIC_ASSETS_RE, '').replace(withTrailingSlash(dir.baseURL || '/'), withTrailingSlash(dir.dir))
      if (existsSync(path)) {
        return id
      }
    }
  }

  return { resolveFromPublicAssets }
}
