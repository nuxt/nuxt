import { resolve } from 'path'
import consola from 'consola'
import { rollup } from 'rollup'
import Hookable from 'hookable'
import { readFile, emptyDir } from 'fs-extra'
import { printFSTree } from './utils/tree'
import { getRollupConfig } from './rollup/config'
import { hl, serializeTemplate, writeFile } from './utils'
import { SLSOptions } from './config'

export async function build (options: SLSOptions) {
  consola.info(`Generating bundle for ${hl(options.target)}`)

  const hooks = new Hookable()
  hooks.addHooks(options.hooks)

  if (options.cleanTargetDir) {
    await emptyDir(options.targetDir)
  }

  // Compile html template
  const htmlSrc = resolve(options.buildDir, `views/${{ 2: 'app', 3: 'document' }[2]}.template.html`)
  const htmlTemplate = { src: htmlSrc, contents: '', dst: '', compiled: '' }
  htmlTemplate.dst = htmlTemplate.src.replace(/.html$/, '.js').replace('app.', 'document.')
  htmlTemplate.contents = await readFile(htmlTemplate.src, 'utf-8')
  htmlTemplate.compiled = 'module.exports = ' + serializeTemplate(htmlTemplate.contents)
  await hooks.callHook('template:document', htmlTemplate)
  await writeFile(htmlTemplate.dst, htmlTemplate.compiled)

  options.rollupConfig = getRollupConfig(options)

  await hooks.callHook('rollup:before', options)

  const build = await rollup(options.rollupConfig).catch((error) => {
    error.message = '[serverless] Rollup Error: ' + error.message
    throw error
  })

  await build.write(options.rollupConfig.output)

  await printFSTree(options.targetDir)

  await hooks.callHook('done', options)

  return {
    entry: resolve(options.rollupConfig.output.dir, options.rollupConfig.output.entryFileNames)
  }
}
