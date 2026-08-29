import { existsSync } from 'node:fs'
import { useNitro } from '@nuxt/kit'
import { joinURL, withLeadingSlash, withTrailingSlash } from 'ufo'
import { dirname, relative } from 'pathe'
import { generateTransform, rolldownString } from 'rolldown-string'
import { isCSSRequest } from 'vite'
import type { Plugin } from 'vite'

import { isInlineStyleId } from '../utils/inline-styles.ts'

const PREFIX = '\0virtual:public?'
const PREFIX_RE = /^\0virtual:public\?/
const CSS_URL_RE = /url\((\/[^)]+)\)/g
const CSS_URL_SINGLE_RE = /url\(\/[^)]+\)/
const QUOTE_RE = /['"`]/

/**
 * Find the quote character of the string literal containing the given index, so that
 * merged chunks with differently-quoted literals are each handled correctly.
 */
function enclosingQuote (code: string, index: number) {
  for (let i = index - 1; i >= 0; i--) {
    if (QUOTE_RE.test(code[i]!) && code[i - 1] !== '\\') {
      return code[i]!
    }
  }
  return '"'
}

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
        for (const match of code.matchAll(CSS_URL_RE)) {
          const [full, url] = match
          if (url && resolveFromPublicAssets(url)) {
            s.update(match.index, match.index + full.length, `url(${joinURL(options.baseURL!, url)})`)
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
        if (!isInlineStyleId(chunk.facadeModuleId)) { return }

        const s = rolldownString(code, chunk.fileName)
        for (const match of code.matchAll(CSS_URL_RE)) {
          const [full, url] = match
          if (url && resolveFromPublicAssets(url)) {
            const q = enclosingQuote(code, match.index)
            // update by index to cover every `url()` in a chunk
            s.update(match.index, match.index + full.length, `url(${q} + publicAssetsURL(${q}${url}${q}) + ${q})`)
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
