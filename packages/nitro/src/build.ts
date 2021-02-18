import { resolve, join } from 'upath'
import consola from 'consola'
import { rollup, watch as rollupWatch } from 'rollup'
import { readFile, emptyDir, copy } from 'fs-extra'
import { printFSTree } from './utils/tree'
import { getRollupConfig } from './rollup/config'
import { hl, prettyPath, serializeTemplate, writeFile, isDirectory } from './utils'
import { NitroContext } from './context'
import { scanMiddleware } from './server/middleware'

export async function prepare (nitroContext: NitroContext) {
  consola.info(`Nitro preset is ${hl(nitroContext.preset)}`)

  await cleanupDir(nitroContext.output.dir)

  if (!nitroContext.output.publicDir.startsWith(nitroContext.output.dir)) {
    await cleanupDir(nitroContext.output.publicDir)
  }

  if (!nitroContext.output.serverDir.startsWith(nitroContext.output.dir)) {
    await cleanupDir(nitroContext.output.serverDir)
  }
}

async function cleanupDir (dir: string) {
  consola.info('Cleaning up', prettyPath(dir))
  await emptyDir(dir)
}

export async function generate (nitroContext: NitroContext) {
  consola.start('Generating public...')

  const clientDist = resolve(nitroContext._nuxt.buildDir, 'dist/client')
  if (await isDirectory(clientDist)) {
    await copy(clientDist, join(nitroContext.output.publicDir, nitroContext._nuxt.publicPath))
  }

  const staticDir = resolve(nitroContext._nuxt.srcDir, nitroContext._nuxt.staticDir)
  if (await isDirectory(staticDir)) {
    await copy(staticDir, nitroContext.output.publicDir)
  }

  consola.success('Generated public ' + prettyPath(nitroContext.output.publicDir))
}

export async function build (nitroContext: NitroContext) {
  // Compile html template
  const htmlSrc = resolve(nitroContext._nuxt.buildDir, `views/${{ 2: 'app', 3: 'document' }[2]}.template.html`)
  const htmlTemplate = { src: htmlSrc, contents: '', dst: '', compiled: '' }
  htmlTemplate.dst = htmlTemplate.src.replace(/.html$/, '.js').replace('app.', 'document.')
  htmlTemplate.contents = await readFile(htmlTemplate.src, 'utf-8')
  htmlTemplate.compiled = 'module.exports = ' + serializeTemplate(htmlTemplate.contents)
  await nitroContext._internal.hooks.callHook('nitro:template:document', htmlTemplate)
  await writeFile(htmlTemplate.dst, htmlTemplate.compiled)

  nitroContext.rollupConfig = getRollupConfig(nitroContext)
  await nitroContext._internal.hooks.callHook('nitro:rollup:before', nitroContext)
  return nitroContext._nuxt.dev ? _watch(nitroContext) : _build(nitroContext)
}

async function _build (nitroContext: NitroContext) {
  nitroContext.scannedMiddleware = await scanMiddleware(nitroContext._nuxt.serverDir)

  consola.start('Building server...')
  const build = await rollup(nitroContext.rollupConfig).catch((error) => {
    consola.error('Rollup error: ' + error.message)
    throw error
  })

  consola.start('Writing server bundle...')
  await build.write(nitroContext.rollupConfig.output)

  consola.success('Server built')
  await printFSTree(nitroContext.output.serverDir)
  await nitroContext._internal.hooks.callHook('nitro:compiled', nitroContext)

  return {
    entry: resolve(nitroContext.rollupConfig.output.dir, nitroContext.rollupConfig.output.entryFileNames)
  }
}

async function _watch (nitroContext: NitroContext) {
  const watcher = rollupWatch(nitroContext.rollupConfig)

  nitroContext.scannedMiddleware = await scanMiddleware(nitroContext._nuxt.serverDir,
    (middleware, event, file) => {
      nitroContext.scannedMiddleware = middleware
      watcher.emit(event, file)
    }
  )

  let start

  watcher.on('event', (event) => {
    switch (event.code) {
      // The watcher is (re)starting
      case 'START':
        return

      // Building an individual bundle
      case 'BUNDLE_START':
        start = Date.now()
        return

      // Finished building all bundles
      case 'END':
        nitroContext._internal.hooks.callHook('nitro:compiled', nitroContext)
        consola.success('Nitro built', start ? `in ${Date.now() - start} ms` : '')
        return

      // Encountered an error while bundling
      case 'ERROR':
        consola.error('Rollup error: ' + event.error)
        // consola.error(event.error)
    }
  })
}
