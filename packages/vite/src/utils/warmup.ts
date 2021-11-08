import consola from 'consola'
import type { ViteDevServer } from 'vite'

export async function warmupViteServer (server: ViteDevServer, entries: string[]) {
  const warmedUrls = new Set<String>()

  const warmup = async (url: string) => {
    if (warmedUrls.has(url)) { return undefined }
    warmedUrls.add(url)
    try {
      await server.transformRequest(url)
    } catch (e) {
      consola.debug('Warmup for %s failed with: %s', url, e)
    }
    const deps = Array.from(server.moduleGraph.urlToModuleMap.get(url)?.importedModules || [])
    await Promise.all(deps.map(m => warmup(m.url)))
  }

  await Promise.all(entries.map(entry => warmup(entry)))
}
