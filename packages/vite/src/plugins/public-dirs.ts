import { existsSync } from 'node:fs'
import { useNitro } from '@nuxt/kit'
import { createUnplugin } from 'unplugin'
import { withLeadingSlash, withTrailingSlash } from 'ufo'
import { dirname, relative } from 'pathe'
import MagicString from 'magic-string'

const PREFIX = 'virtual:public?'
const CSS_URL_RE = /url\((\/[^)]+)\)/g

export const VitePublicDirsPlugin = createUnplugin((options: { sourcemap?: boolean }) => {
  const { resolveFromPublicAssets } = useResolveFromPublicAssets()

  return {
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
          if (id === '/__skip_vite' || !id.startsWith('/') || id.startsWith('/@fs')) { return }

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
          if (resolveFromPublicAssets(url)) {
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
        for (const file in bundle) {
          const chunk = bundle[file]
          if (!file.endsWith('.css') || chunk.type !== 'asset') { continue }

          let css = chunk.source.toString()
          let wasReplaced = false
          for (const [full, url] of css.matchAll(CSS_URL_RE)) {
            if (resolveFromPublicAssets(url)) {
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
  }
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
