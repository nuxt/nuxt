import { resolve, relative } from 'pathe'
import chokidar from 'chokidar'
import { debounce } from 'perfect-debounce'
import type { Nuxt } from '@nuxt/schema'
import consola from 'consola'
import { withTrailingSlash } from 'ufo'
import { createServer, createLoadingHandler } from '../utils/server'
import { showBanner } from '../utils/banner'
import { writeTypes } from '../utils/prepare'
import { loadKit } from '../utils/kit'
import { clearDir } from '../utils/fs'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'dev',
    usage: 'npx nuxi dev [rootDir] [--clipboard] [--open, -o] [--port, -p] [--host, -h] [--https] [--ssl-cert] [--ssl-key]',
    description: 'Run nuxt development server'
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'development'
    const server = createServer()
    const listener = await server.listen({
      clipboard: args.clipboard,
      open: args.open || args.o,
      port: args.port || args.p,
      hostname: args.host || args.h,
      https: Boolean(args.https),
      certificate: (args['ssl-cert'] && args['ssl-key']) && {
        cert: args['ssl-cert'],
        key: args['ssl-key']
      }
    })

    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt, buildNuxt } = await loadKit(rootDir)

    let currentNuxt: Nuxt
    const load = async (isRestart: boolean, reason?: string) => {
      try {
        const message = `${reason ? reason + '. ' : ''}${isRestart ? 'Restarting' : 'Starting'} nuxt...`
        server.setApp(createLoadingHandler(message))
        if (isRestart) {
          consola.info(message)
        }
        if (currentNuxt) {
          await currentNuxt.close()
        }
        currentNuxt = await loadNuxt({ rootDir, dev: true, ready: false })
        await clearDir(currentNuxt.options.buildDir)
        await currentNuxt.ready()
        await Promise.all([
          writeTypes(currentNuxt).catch(console.error),
          buildNuxt(currentNuxt)
        ])
        server.setApp(currentNuxt.server.app)
        if (isRestart && args.clear !== false) {
          showBanner()
          listener.showURL()
        }
      } catch (err) {
        consola.error(`Cannot ${isRestart ? 'restart' : 'start'} nuxt: `, err)
        server.setApp(createLoadingHandler(
          'Error while loading nuxt. Please check console and fix errors.'
        ))
      }
    }

    // Watch for config changes
    // TODO: Watcher service, modules, and requireTree
    const dLoad = debounce(load)
    const watcher = chokidar.watch([rootDir], { ignoreInitial: true, depth: 1 })
    watcher.on('all', (event, file) => {
      if (!currentNuxt) { return }
      if (file.startsWith(withTrailingSlash(currentNuxt.options.buildDir))) { return }
      if (file.match(/(nuxt\.config\.(js|ts|mjs|cjs)|\.nuxtignore|\.env|\.nuxtrc)$/)) {
        dLoad(true, `${relative(rootDir, file)} updated`)
      }

      const isDirChange = ['addDir', 'unlinkDir'].includes(event)
      const isFileChange = ['add', 'unlink'].includes(event)
      const reloadDirs = [currentNuxt.options.dir.pages, 'components', 'composables']

      if (isDirChange) {
        const dir = reloadDirs.find(dir => file.endsWith(dir))
        if (dir) {
          dLoad(true, `Directory \`${dir}/\` ${event === 'addDir' ? 'created' : 'removed'}`)
        }
      } else if (isFileChange) {
        if (file.match(/(app|error)\.(js|ts|mjs|jsx|tsx|vue)$/)) {
          dLoad(true, `\`${relative(rootDir, file)}\` ${event === 'add' ? 'created' : 'removed'}`)
        }
      }
    })

    await load(false)
    if (currentNuxt) {
      await currentNuxt.hooks.callHook('listen', listener.server, listener)
    }
  }
})
