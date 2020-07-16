import { promises as fs } from 'fs'
import { join, extname, sep } from 'path'
import consola from 'consola'
import connect from 'connect'
import serveStatic from 'serve-static'
import compression from 'compression'
import { getNuxtConfig } from '@nuxt/config'
import { showBanner } from '../utils/banner'
import * as imports from '../imports'

export async function serve (cmd) {
  const _config = await cmd.getNuxtConfig({ dev: false })

  // add default options
  const options = getNuxtConfig(_config)

  try {
    // overwrites with build config
    const buildConfig = require(join(options.buildDir, 'nuxt/config.json'))
    options.target = buildConfig.target
  } catch (err) { }

  const distStat = await fs.stat(options.generate.dir).catch(err => null) // eslint-disable-line handle-callback-err
  const distPath = join(options.generate.dir.replace(process.cwd() + sep, ''), sep)
  if (!distStat || !distStat.isDirectory()) {
    throw new Error('Output directory `' + distPath + '` does not exists, please use `nuxt generate` before `nuxt start` for static target.')
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
  const { Listener } = await imports.server()
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

  const { Nuxt } = await imports.core()

  showBanner({
    constructor: Nuxt,
    options,
    server: {
      listeners: [listener]
    }
  }, false)

  consola.info(`Serving static application from \`${distPath}\``)
}
