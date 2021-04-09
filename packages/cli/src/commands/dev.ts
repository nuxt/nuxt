import { createServer } from '../utils/server'
import { buildNuxt, loadNuxt } from '../utils/nuxt'

export async function invoke (args) {
  const server = createServer()
  const listenPromise = server.listen({ clipboard: true })

  const nuxt = await loadNuxt({
    rootDir: args._[0],
    for: 'dev'
  })

  server.setApp(nuxt.server.app)

  await buildNuxt(nuxt)

  await listenPromise
}

export const meta = {
  usage: 'nu dev [rootDir]',
  description: 'Run nuxt development server'
}
