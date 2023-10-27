import { logger } from '@nuxt/kit'
import { join, normalize, relative } from 'pathe'
import type { ViteDevServer } from 'vite'

// https://github.com/vitejs/vite/tree/main/packages/vite/src/node/server/warmup.ts#L62-L70
function fileToUrl (file: string, root: string) {
  const url = relative(root, file)
  // out of root, use /@fs/ prefix
  if (url[0] === '.') {
    return join('/@fs/', normalize(file))
  }
  // file within root, create root-relative url
  return '/' + normalize(url)
}

export async function warmupViteServer (
  server: ViteDevServer,
  entries: string[],
  isServer: boolean
) {
  const warmedUrls = new Set<String>()

  const warmup = async (url: string) => {
    if (warmedUrls.has(url)) { return }
    warmedUrls.add(url)
    try {
      await server.transformRequest(url, { ssr: isServer })
    } catch (e) {
      logger.debug('Warmup for %s failed with: %s', url, e)
    }
  }

  await Promise.all(entries.map(entry => warmup(fileToUrl(entry, server.config.root))))
}
