import { resolve, join } from 'upath'
import consola from 'consola'
import { rollup, watch as rollupWatch } from 'rollup'
import ora from 'ora'
import { readFile, emptyDir, copy } from 'fs-extra'
import { printFSTree } from './utils/tree'
import { getRollupConfig } from './rollup/config'
import { hl, serializeTemplate, writeFile } from './utils'
import { SigmaContext } from './context'

export async function build (sigmaContext: SigmaContext) {
  consola.info(`Sigma preset is ${hl(sigmaContext.preset)}`)

  // Cleanup output dir
  await emptyDir(sigmaContext.output.dir)

  // Compile html template
  const htmlSrc = resolve(sigmaContext._nuxt.buildDir, `views/${{ 2: 'app', 3: 'document' }[2]}.template.html`)
  const htmlTemplate = { src: htmlSrc, contents: '', dst: '', compiled: '' }
  htmlTemplate.dst = htmlTemplate.src.replace(/.html$/, '.js').replace('app.', 'document.')
  htmlTemplate.contents = await readFile(htmlTemplate.src, 'utf-8')
  htmlTemplate.compiled = 'module.exports = ' + serializeTemplate(htmlTemplate.contents)
  await sigmaContext._internal.hooks.callHook('sigma:template:document', htmlTemplate)
  await writeFile(htmlTemplate.dst, htmlTemplate.compiled)

  await generate(sigmaContext)

  sigmaContext.rollupConfig = getRollupConfig(sigmaContext)

  await sigmaContext._internal.hooks.callHook('sigma:rollup:before', sigmaContext)

  return sigmaContext._nuxt.dev ? _watch(sigmaContext) : _build(sigmaContext)
}

export async function generate (sigmaContext: SigmaContext) {
  await copy(
    resolve(sigmaContext._nuxt.buildDir, 'dist/client'),
    join(sigmaContext.output.publicDir, sigmaContext._nuxt.publicPath)
  )
  await copy(
    resolve(sigmaContext._nuxt.srcDir, sigmaContext._nuxt.staticDir),
    sigmaContext.output.publicDir
  )
}

async function _build (sigmaContext: SigmaContext) {
  const spinner = ora()

  spinner.start('Building server...')
  const build = await rollup(sigmaContext.rollupConfig).catch((error) => {
    spinner.fail('Rollup error: ' + error.messsage)
    throw error
  })

  spinner.start('Wrting Sigma bundle...')
  await build.write(sigmaContext.rollupConfig.output)

  spinner.succeed('Sigma built')
  await printFSTree(sigmaContext.output.serverDir)
  await sigmaContext._internal.hooks.callHook('sigma:compiled', sigmaContext)

  return {
    entry: resolve(sigmaContext.rollupConfig.output.dir, sigmaContext.rollupConfig.output.entryFileNames)
  }
}

function _watch (sigmaContext: SigmaContext) {
  const spinner = ora()

  const watcher = rollupWatch(sigmaContext.rollupConfig)

  let start

  watcher.on('event', (event) => {
    switch (event.code) {
      // The watcher is (re)starting
      case 'START':
        return

      // Building an individual bundle
      case 'BUNDLE_START':
        start = Date.now()
        spinner.start('Building Sigma...')
        return

      // Finished building all bundles
      case 'END':
        sigmaContext._internal.hooks.callHook('sigma:compiled', sigmaContext)
        return spinner.succeed(`Sigma built in ${Date.now() - start} ms`)

      // Encountered an error while bundling
      case 'ERROR':
        spinner.fail('Rollup error: ' + event.error)
        // consola.error(event.error)
    }
  })
}
