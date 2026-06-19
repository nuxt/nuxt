import { existsSync } from 'node:fs'
import { useNitro } from '@nuxt/kit'
import { withLeadingSlash, withTrailingSlash } from 'ufo'
import { dirname, relative } from 'pathe'
import MagicString from 'magic-string'
import type { NastiPlugin } from '@nasti-toolchain/nasti'

const PREFIX = '\0virtual:public?'
const CSS_URL_RE = /url\((\/[^)]+)\)/g
const CSS_URL_SINGLE_RE = /url\(\/[^)]+\)/
const CSS_RE = /\.(?:css|s[ac]ss|less|styl|stylus|pcss|postcss)(?:$|\?)/

interface PublicDirsPluginOptions {
  dev?: boolean
  baseURL?: string
}

const PUBLIC_ASSETS_RE = /[?#].*$/

/** Resolve a request URL against Nitro's configured public asset directories. */
export function useResolveFromPublicAssets () {
  const nitro = useNitro()

  function resolveFromPublicAssets (id: string) {
    for (const dir of nitro.options.publicAssets) {
      if (!id.startsWith(withTrailingSlash(dir.baseURL || '/'))) {
        continue
      }
      const path = id.replace(PUBLIC_ASSETS_RE, '').replace(withTrailingSlash(dir.baseURL || '/'), withTrailingSlash(dir.dir))
      if (existsSync(path)) {
        return id
      }
    }
  }

  return { resolveFromPublicAssets }
}

/**
 * Resolves references to files in Nuxt's public asset directories, mirroring
 * `@nuxt/vite-builder`'s `PublicDirsPlugin`, adapted to Nasti's bare plugin hooks
 * (Nasti has no Vite-style object-hook `filter`, so guards are inline).
 */
export function PublicDirsPlugin (options: PublicDirsPluginOptions): NastiPlugin[] {
  const { resolveFromPublicAssets } = useResolveFromPublicAssets()
  const rewriteDevCss = !!options.dev && !!options.baseURL && options.baseURL !== '/'

  return [
    {
      name: 'nuxt:nasti:public-dir-resolution-dev',
      apply: rewriteDevCss ? 'serve' : () => false,
      transform (code, id) {
        if (!CSS_RE.test(id) || !CSS_URL_SINGLE_RE.test(code)) {
          return
        }
        const s = new MagicString(code)
        for (const [full, url] of code.matchAll(CSS_URL_RE)) {
          if (url && resolveFromPublicAssets(url)) {
            s.replace(full, `url(${options.baseURL}${url})`)
          }
        }
        if (!s.hasChanged()) {
          return
        }
        return { code: s.toString(), map: s.generateMap({ hires: true }) }
      },
    },
    {
      name: 'nuxt:nasti:public-dir-resolution',
      resolveId (id) {
        // skip the dev skip-marker, bare specifiers and /@fs paths
        if (id === '/__skip_nasti' || /^[^/]/.test(id) || id.startsWith('/@fs')) {
          return
        }
        if (resolveFromPublicAssets(id)) {
          return PREFIX + encodeURIComponent(id)
        }
      },
      load (id) {
        if (!id.startsWith(PREFIX)) {
          return
        }
        const url = decodeURIComponent(id.slice(PREFIX.length))
        return `import { publicAssetsURL } from '#internal/nuxt/paths';export default publicAssetsURL(${JSON.stringify(url)})`
      },
      generateBundle (_options, bundle) {
        for (const [file, chunk] of Object.entries((bundle ?? {}) as Record<string, any>)) {
          if (!file.endsWith('.css') || chunk?.type !== 'asset') {
            continue
          }
          let css = String(chunk.source)
          let changed = false
          for (const [full, url] of css.matchAll(CSS_URL_RE)) {
            if (url && resolveFromPublicAssets(url)) {
              const relativeURL = relative(withLeadingSlash(dirname(file)), url)
              css = css.replace(full, `url(${relativeURL})`)
              changed = true
            }
          }
          if (changed) {
            chunk.source = css
          }
        }
      },
    },
  ]
}
