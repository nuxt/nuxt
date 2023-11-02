import { logger } from '@nuxt/kit'
import { join, normalize, relative } from 'pathe'
import { withoutBase } from 'ufo'
import { isCSSRequest } from 'vite'
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

function normaliseURL (url: string, base: string) {
  // remove any base url
  url = withoutBase(url, base)
  // unwrap record
  if (url.startsWith('/@id/')) {
    url = url.slice('/@id/'.length).replace('__x00__', '\0')
  }
  // strip query
  url = url.replace(/(\?|&)import=?(?:&|$)/, '').replace(/[?&]$/, '')
  return url
}

// TODO: use built-in warmup logic when we update to vite 5
export async function warmupViteServer (
  server: ViteDevServer,
  entries: string[],
  isServer: boolean
) {
  const warmedUrls = new Set<String>()

  const warmup = async (url: string) => {
    try {
      url = normaliseURL(url, server.config.base)

      if (warmedUrls.has(url)) { return }
      const m = await server.moduleGraph.getModuleByUrl(url, isServer)
      // a module that is already compiled (and can't be warmed up anyway)
      if (m?.transformResult?.code || m?.ssrTransformResult?.code) {
        return
      }
      warmedUrls.add(url)
      await server.transformRequest(url, { ssr: isServer })
    } catch (e) {
      logger.debug('[nuxt] warmup for %s failed with: %s', url, e)
    }

    // Don't warmup CSS file dependencies as they have already all been loaded to produce result
    if (isCSSRequest(url)) { return }

    try {
      const mod = await server.moduleGraph.getModuleByUrl(url, isServer)
      const deps = mod?.ssrTransformResult?.deps /* server */ || Array.from(mod?.importedModules /* client */ || []).map(m => m.url)
      await Promise.all(deps.map(m => warmup(m)))
    } catch (e) {
      logger.debug('[warmup] tracking dependencies for %s failed with: %s', url, e)
    }
  }

  await Promise.all(entries.map(entry => warmup(fileToUrl(entry, server.config.root))))
}
