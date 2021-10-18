import { resolve, relative } from 'pathe'
import chokidar from 'chokidar'
import debounce from 'p-debounce'
import type { Nuxt } from '@nuxt/kit'
import consola from 'consola'
import { createServer, createLoadingHandler } from '../utils/server'
import { showBanner } from '../utils/banner'
import { writeTypes } from '../utils/prepare'
import { loadKit } from '../utils/kit'
import { clearDir } from '../utils/fs'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'dev',
    usage: 'npx nuxi dev [rootDir] [--clipboard] [--open, -o] [--port, -p] [--host, -h] [--ssl-cert] [--ssl-key]',
    description: 'Run nuxt development server'
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'development'
    const https = !!(args['ssl-cert'] && args['ssl-key'])
    const server = createServer()
    const listener = await server.listen({
      clipboard: args.clipboard,
      open: args.open || args.o,
      port: args.port || args.p,
      hostname: args.host || args.h,
      ...(https && {
        https,
        certificate: {
          cert: args['ssl-cert'],
          key: args['ssl-key']
        }
      })
    })

    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt, buildNuxt } = await loadKit(rootDir)

    const prepare = debounce((nuxt: Nuxt) => writeTypes(nuxt), 1000)

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
        const newNuxt = await loadNuxt({ rootDir, dev: true, ready: false })
        await clearDir(newNuxt.options.buildDir)
        prepare(newNuxt)
        currentNuxt = newNuxt
        await currentNuxt.ready()
        await buildNuxt(currentNuxt)
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
    const dLoad = debounce(load, 250)
    const watcher = chokidar.watch([rootDir], { ignoreInitial: true, depth: 1 })
    watcher.on('all', (_event, file) => {
      if (!currentNuxt) { return }
      if (file.startsWith(currentNuxt.options.buildDir)) { return }
      if (file.match(/nuxt\.config\.(js|ts|mjs|cjs)$/)) {
        dLoad(true, `${relative(rootDir, file)} updated`)
      }
      if (['addDir', 'unlinkDir'].includes(_event) && file.match(/pages$/)) {
        dLoad(true, `Directory \`pages/\` ${_event === 'addDir' ? 'created' : 'removed'}`)
      }
      if (['addDir', 'unlinkDir'].includes(_event) && file.match(/components$/)) {
        dLoad(true, `Directory \`components/\` ${_event === 'addDir' ? 'created' : 'removed'}`)
      }
      if (['add', 'unlink'].includes(_event) && file.match(/app\.(js|ts|mjs|jsx|tsx|vue)$/)) {
        dLoad(true, `\`${relative(rootDir, file)}\` ${_event === 'add' ? 'created' : 'removed'}`)
      }
    })

    await load(false)
  }
})
