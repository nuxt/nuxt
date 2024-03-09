import { existsSync } from 'node:fs'
import { createUnplugin } from 'unplugin'
import { withTrailingSlash } from 'ufo'
import { useNitro } from '@nuxt/kit'

const PREFIX = 'virtual:public?'

export const VitePublicDirsPlugin = createUnplugin(() => {
  const nitro = useNitro()
  const publicFiles = new Set()

  return {
    name: 'nuxt:vite-public-dir-resolution',
    vite: {
      load: {
        enforce: 'pre',
        handler (id) {
          if (id.startsWith(PREFIX)) {
            return `export default __publicAssetsURL(${JSON.stringify(decodeURIComponent(id.slice(PREFIX.length)))})`
          }
        }
      },
      resolveId: {
        enforce: 'post',
        handler (id) {
          if (id === '/__skip_vite' || !id.startsWith('/') || id.startsWith('/@fs')) { return }

          for (const dir of nitro.options.publicAssets) {
            if (!id.startsWith(withTrailingSlash(dir.baseURL || '/'))) { continue }
            const path = id.replace(withTrailingSlash(dir.baseURL || '/'), withTrailingSlash(dir.dir))
            if (existsSync(path)) {
              publicFiles.add(path)
              return PREFIX + encodeURIComponent(id)
            }
          }
        }
      }
    }
  }
})
