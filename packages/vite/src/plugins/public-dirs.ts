import { existsSync } from 'node:fs'
import { useNitro, useNuxt } from '@nuxt/kit'
import { createUnplugin } from 'unplugin'
import { joinURL, withLeadingSlash, withTrailingSlash } from 'ufo'
import { dirname, relative } from 'pathe'
import { globby } from 'globby'

const PREFIX = 'virtual:public?'

export async function listPublicAssets () {
  const nitro = useNitro()
  const nuxt = useNuxt()
  const publicFiles = new Set<string>()
  for (const dir of nitro.options.publicAssets) {
    const files = await globby('**/*', {
      cwd: dir.dir,
      absolute: false,
      ignore: [
        ...nuxt.options.ignore,
        'node_modules'
      ]
    })
    for (const file of files) {
      publicFiles.add(joinURL(dir.baseURL || '/', file))
    }
  }
  return [...publicFiles]
}

export const VitePublicDirsPlugin = createUnplugin(() => {
  const nitro = useNitro()

  function resolveFromPublicAssets (id: string) {
    for (const dir of nitro.options.publicAssets) {
      if (!id.startsWith(withTrailingSlash(dir.baseURL || '/'))) { continue }
      const path = id.replace(withTrailingSlash(dir.baseURL || '/'), withTrailingSlash(dir.dir))
      if (existsSync(path)) {
        return id
      }
    }
  }

  return {
    name: 'nuxt:vite-public-dir-resolution',
    vite: {
      load: {
        enforce: 'pre',
        handler (id) {
          if (id.startsWith(PREFIX)) {
            return `import { publicAssetsURL } from '#internal/nuxt/paths';export default publicAssetsURL(${JSON.stringify(decodeURIComponent(id.slice(PREFIX.length)))})`
          }
        }
      },
      resolveId: {
        enforce: 'post',
        handler (id) {
          if (id === '/__skip_vite' || !id.startsWith('/') || id.startsWith('/@fs')) { return }

          if (resolveFromPublicAssets(id)) {
            return PREFIX + encodeURIComponent(id)
          }
        }
      },
      generateBundle (outputOptions, bundle) {
        for (const file in bundle) {
          const chunk = bundle[file]
          if (!file.endsWith('.css') || chunk.type !== 'asset') { continue }

          let css = chunk.source.toString()
          let wasReplaced = false
          for (const [full, url] of css.matchAll(/url\((\/[^)]+)\)/g)) {
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
      }
    }
  }
})
