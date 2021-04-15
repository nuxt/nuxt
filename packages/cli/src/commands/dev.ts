import { resolve } from 'path'
import chokidar from 'chokidar'
import debounce from 'debounce-promise'
import { createServer, createLoadingHandler } from '../utils/server'
import { showBanner } from '../utils/banner'
import { requireModule } from '../utils/cjs'
import { error, info } from '../utils/log'
import { diff, printDiff } from '../utils/diff'

export async function invoke (args) {
  const server = createServer()
  const listener = await server.listen({ clipboard: true, open: true })

  const rootDir = resolve(args._[0] || '.')

  const { loadNuxt, buildNuxt } = requireModule('@nuxt/kit', rootDir)

  const watcherFiles = new Set()
  const watcher = chokidar.watch([rootDir], { ignoreInitial: true, depth: 0 })

  let currentNuxt
  const load = async () => {
    try {
      const newNuxt = await loadNuxt({ rootDir, dev: true, ready: false })
      watcherFiles.add(newNuxt.options.watch)

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

      showBanner(true)
      listener.showURL()

      if (configChanges) {
        if (configChanges.length) {
          info('Nuxt config updated:')
          printDiff(configChanges)
        } else {
          info('Restarted nuxt due to config changes')
        }
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

  const dLoad = debounce(load, 250)
  watcher.on('all', (_event, file) => {
    if (watcherFiles.has(file) || file.includes('nuxt.config')) {
      dLoad()
    }
  })

  await load()
}

export const meta = {
  usage: 'nu dev [rootDir]',
  description: 'Run nuxt development server'
}
