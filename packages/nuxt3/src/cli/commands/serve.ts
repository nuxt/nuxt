import { promises as fs } from 'fs'
import { join, extname, basename } from 'path'
import connect from 'connect'
import serveStatic from 'serve-static'
import compression from 'compression'
import { getNuxtConfig } from 'src/config'
import { TARGETS } from 'src/utils'
import { common, server } from '../options'
import { showBanner } from '../utils/banner'
import { Listener } from 'src/server'
import { Nuxt } from 'src/core'

export default {
  name: 'serve',
  description: 'Serve the exported static application (should be compiled with `nuxt build` and `nuxt export` first)',
  usage: 'serve <dir>',
  options: {
    'config-file': common['config-file'],
    version: common.version,
    help: common.help,
    ...server
  },
  async run (cmd) {
    let options = await cmd.getNuxtConfig({ dev: false })
    // add default options
    options = getNuxtConfig(options)
    try {
      // overwrites with build config
      const buildConfig = require(join(options.buildDir, 'nuxt/config.json'))
      options.target = buildConfig.target
    } catch (err) {}

    if (options.target === TARGETS.server) {
      throw new Error('You cannot use `nuxt serve` with ' + TARGETS.server + ' target, please use `nuxt start`')
    }
    const distStat = await fs.stat(options.generate.dir).catch(err => null) // eslint-disable-line handle-callback-err
    if (!distStat || !distStat.isDirectory()) {
      throw new Error('Output directory `' + basename(options.generate.dir) + '/` does not exists, please run `nuxt export` before `nuxt serve`.')
    }
    const app = connect()
    app.use(compression({ threshold: 0 }))
    app.use(
      options.router.base,
      serveStatic(options.generate.dir, {
        extensions: ['html']
      })
    )
    if (options.generate.fallback) {
      const fallbackFile = await fs.readFile(join(options.generate.dir, options.generate.fallback), 'utf-8')
      app.use((req, res, next) => {
        const ext = extname(req.url) || '.html'

        if (ext !== '.html') {
          return next()
        }
        res.writeHeader(200, {
          'Content-Type': 'text/html'
        })
        res.write(fallbackFile)
        res.end()
      })
    }

    const { port, host, socket, https } = options.server
    const listener = new Listener({
      port,
      host,
      socket,
      https,
      app,
      dev: true, // try another port if taken
      baseURL: options.router.base
    })
    await listener.listen()
    showBanner({
      constructor: Nuxt,
      options,
      server: {
        listeners: [listener]
      }
    }, false)
  }
}
