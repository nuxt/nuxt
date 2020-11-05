import { resolve } from 'path'
import consola from 'consola'
import { rollup, OutputOptions } from 'rollup'
import Hookable from 'hookable'
import prettyBytes from 'pretty-bytes'
import gzipSize from 'gzip-size'
import chalk from 'chalk'
import { emptyDir } from 'fs-extra'
import { getRollupConfig } from './rollup/config'
import { hl, prettyPath, renderTemplate, compileTemplateToJS } from './utils'
import { getTargetConfig, SLSConfig } from './config'

export async function build (baseConfig, target) {
  console.log('\n')
  consola.info(`Generating bundle for ${hl(target.target)}`)

  const config: any = getTargetConfig(baseConfig, target)

  const hooks = new Hookable()
  hooks.addHooks(config.hooks)

  await hooks.callHook('config', config)

  emptyDir(config.targetDir)

  config.rollupConfig = getRollupConfig(config)
  await hooks.callHook('rollup:before', config)
  const build = await rollup(config.rollupConfig)

  const { output } = await build.write(config.rollupConfig.output as OutputOptions)
  const size = prettyBytes(output[0].code.length)
  const zSize = prettyBytes(await gzipSize(output[0].code))
  consola.success('Generated', prettyPath((config.rollupConfig.output as any).file),
    chalk.gray(`(Size: ${size} Gzip: ${zSize})`)
  )

  for (const tmpl of config.templates) {
    const dstPath = resolve(config.targetDir, tmpl.dst)
    await renderTemplate(tmpl.src, dstPath, { config })
    consola.info('Compiled', prettyPath(dstPath))
  }

  await hooks.callHook('done', config)
}

export async function compileHTMLTemplate (baseConfig: SLSConfig) {
  const htmlTemplateFile = resolve(baseConfig.buildDir, `views/${{ 2: 'app', 3: 'document' }[baseConfig.nuxt]}.template.html`)
  const htmlTemplateFileJS = htmlTemplateFile.replace(/.html$/, '.js').replace('app.', 'document.')
  await compileTemplateToJS(htmlTemplateFile, htmlTemplateFileJS)
  consola.info('Generated', prettyPath(htmlTemplateFileJS))
}
