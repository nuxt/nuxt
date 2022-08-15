import { logger } from '@nuxt/kit'
import type { ViteDevServer } from 'vite'

export async function warmupViteServer (
  server: ViteDevServer,
  entries: string[],
  isServer: boolean
) {
  const warmedUrls = new Set<String>()

  const warmup = async (url: string) => {
    if (warmedUrls.has(url)) {
      return
    }
    warmedUrls.add(url)
    try {
      await server.transformRequest(url, { ssr: isServer })
    } catch (e) {
      logger.debug('Warmup for %s failed with: %s', url, e)
    }
    const mod = await server.moduleGraph.getModuleByUrl(url)
    const deps = Array.from(mod?.importedModules || [])
    await Promise.all(deps.map(m => warmup(m.url.replace('/@id/__x00__', '\0'))))
  }

  await Promise.all(entries.map(entry => warmup(entry)))
}
