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
  isServer: boolean,
) {
  await Promise.all(entries.map(entry => server.warmupRequest(
    fileToUrl(entry, server.config.root),
    { ssr: isServer },
  )))
}
