import { resolve } from 'path'
import chokidar from 'chokidar'
import debounce from 'debounce-promise'
import { createServer, createLoadingHandler } from '../utils/server'
import { showBanner } from '../utils/banner'
import { requireModule } from '../utils/cjs'
import { error } from '../utils/log'

export async function invoke (args) {
  process.env.NODE_ENV = process.env.NODE_ENV || 'development'
  const server = createServer()
  const listener = await server.listen({
    clipboard: args.clipboard,
    open: args.open || args.o
  })

  const rootDir = resolve(args._[0] || '.')

  const { loadNuxt, buildNuxt } = requireModule('@nuxt/kit', rootDir)

  let currentNuxt
  const load = async (isRestart) => {
    try {
      const message = `${isRestart ? 'Restarting' : 'Starting'} nuxt...`
      server.setApp(createLoadingHandler(message, 1))
      if (isRestart) {
        console.log(message)
      }
      if (currentNuxt) {
        await currentNuxt.close()
      }
      const newNuxt = await loadNuxt({ rootDir, dev: true, ready: false })
      currentNuxt = newNuxt
      await currentNuxt.ready()
      await buildNuxt(currentNuxt)
      server.setApp(currentNuxt.server.app)
      if (isRestart && args.clear !== false) {
        showBanner()
        listener.showURL()
      }
    } catch (err) {
      error(`Cannot ${isRestart ? 'restart' : 'start'} nuxt: `, err)
      server.setApp(createLoadingHandler(
        'Error while loading nuxt. Please check console and fix errors.'
      ))
    }
  }

  // Watch for config changes
  // TODO: Watcher service, modules, and requireTree
  const dLoad = debounce(load, 250)
  const watcher = chokidar.watch([rootDir], { ignoreInitial: true, depth: 1 })
  watcher.on('all', (_event, file) => {
    if (file.includes('nuxt.config') || file.includes('modules')) {
      dLoad(true)
    }
  })

  await load(false)
}

export const meta = {
  usage: 'nu dev [rootDir] [--clipboard] [--open, -o]',
  description: 'Run nuxt development server'
}
