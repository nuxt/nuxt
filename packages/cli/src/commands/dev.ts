import { resolve } from 'path'
import chokidar from 'chokidar'
import debounce from 'debounce-promise'
import { createServer, createLoadingHandler } from '../utils/server'
import { showBanner } from '../utils/banner'
import { requireModule } from '../utils/cjs'
import { error, info } from '../utils/log'
import { diff, printDiff } from '../utils/diff'

export async function invoke (args) {
  process.env.NODE_ENV = process.env.NODE_ENV || 'development'
  const server = createServer()
  const listener = await server.listen({ clipboard: args.clipboard, open: args.open || args.o })

  const rootDir = resolve(args._[0] || '.')

  const { loadNuxt, buildNuxt } = requireModule('@nuxt/kit', rootDir)

  let currentNuxt
  const load = async () => {
    try {
      showBanner(true)
      listener.showURL()

      const newNuxt = await loadNuxt({ rootDir, dev: true, ready: false })

      if (process.env.DEBUG) {
        let configChanges
        if (currentNuxt) {
          configChanges = diff(currentNuxt.options, newNuxt.options, [
            'generate.staticAssets.version',
            'env.NITRO_PRESET'
          ])
          server.setApp(createLoadingHandler('Restarting...', 1))
          await currentNuxt.close()
          currentNuxt = newNuxt
        } else {
          currentNuxt = newNuxt
        }

        if (configChanges) {
          if (configChanges.length) {
            info('Nuxt config updated:')
            printDiff(configChanges)
          } else {
            info('Restarted nuxt due to config changes')
          }
        }
      } else {
        currentNuxt = newNuxt
      }

      await currentNuxt.ready()
      await buildNuxt(currentNuxt)
      server.setApp(currentNuxt.server.app)
    } catch (err) {
      error('Cannot load nuxt.', err)
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
      dLoad()
    }
  })

  await load()
}

export const meta = {
  usage: 'nu dev [rootDir] [--clipboard] [--open, -o]',
  description: 'Run nuxt development server'
}
