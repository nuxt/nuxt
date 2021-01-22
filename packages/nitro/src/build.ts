import { resolve, join } from 'upath'
import consola from 'consola'
import { rollup, watch as rollupWatch } from 'rollup'
import ora from 'ora'
import { readFile, emptyDir, copy } from 'fs-extra'
import { printFSTree } from './utils/tree'
import { getRollupConfig } from './rollup/config'
import { hl, prettyPath, serializeTemplate, writeFile, isDirectory } from './utils'
import { NitroContext } from './context'

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
  const spinner = ora()
  spinner.start('Generating public...')

  const clientDist = resolve(nitroContext._nuxt.buildDir, 'dist/client')
  if (await isDirectory(clientDist)) {
    await copy(clientDist, join(nitroContext.output.publicDir, nitroContext._nuxt.publicPath))
  }

  const staticDir = resolve(nitroContext._nuxt.srcDir, nitroContext._nuxt.staticDir)
  if (await isDirectory(staticDir)) {
    await copy(staticDir, nitroContext.output.publicDir)
  }

  spinner.succeed('Generated public ' + prettyPath(nitroContext.output.publicDir))
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
  const spinner = ora()

  spinner.start('Building server...')
  const build = await rollup(nitroContext.rollupConfig).catch((error) => {
    spinner.fail('Rollup error: ' + error.message)
    throw error
  })

  spinner.start('Writing server bundle...')
  await build.write(nitroContext.rollupConfig.output)

  spinner.succeed('Server built')
  await printFSTree(nitroContext.output.serverDir)
  await nitroContext._internal.hooks.callHook('nitro:compiled', nitroContext)

  return {
    entry: resolve(nitroContext.rollupConfig.output.dir, nitroContext.rollupConfig.output.entryFileNames)
  }
}

function _watch (nitroContext: NitroContext) {
  const spinner = ora()

  const watcher = rollupWatch(nitroContext.rollupConfig)

  let start

  watcher.on('event', (event) => {
    switch (event.code) {
      // The watcher is (re)starting
      case 'START':
        return

      // Building an individual bundle
      case 'BUNDLE_START':
        start = Date.now()
        spinner.start('Building Nitro...')
        return

      // Finished building all bundles
      case 'END':
        nitroContext._internal.hooks.callHook('nitro:compiled', nitroContext)
        return spinner.succeed(`Nitro built in ${Date.now() - start} ms`)

      // Encountered an error while bundling
      case 'ERROR':
        spinner.fail('Rollup error: ' + event.error)
        // consola.error(event.error)
    }
  })
}
