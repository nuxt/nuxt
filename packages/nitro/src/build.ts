import { resolve } from 'path'
import consola from 'consola'
import { rollup, OutputOptions } from 'rollup'
import Hookable from 'hookable'
import prettyBytes from 'pretty-bytes'
import gzipSize from 'gzip-size'
import chalk from 'chalk'
import { emptyDir } from 'fs-extra'
import { getRollupConfig } from './rollup/config'
import { hl, prettyPath, renderTemplate, compileTemplateToJS, writeFileP } from './utils'
import { SLSOptions } from './config'

export async function build (options: SLSOptions) {
  console.log('\n')
  consola.info(`Generating bundle for ${hl(options.target)}`)

  const hooks = new Hookable()
  hooks.addHooks(options.hooks)

  // Compile html template
  const htmlTemplate = {
    src: resolve(options.buildDir, `views/${{ 2: 'app', 3: 'document' }[options.nuxt]}.template.html`),
    dst: '',
    compiled: ''
  }
  htmlTemplate.dst = htmlTemplate.src.replace(/.html$/, '.js').replace('app.', 'document.')
  htmlTemplate.compiled = await compileTemplateToJS(htmlTemplate.src)
  await hooks.callHook('template:document', htmlTemplate)
  await writeFileP(htmlTemplate.dst, htmlTemplate.compiled)
  consola.info('Generated', prettyPath(htmlTemplate.dst))

  emptyDir(options.slsDir)

  options.rollupConfig = getRollupConfig(options)
  await hooks.callHook('rollup:before', options)
  const build = await rollup(options.rollupConfig)

  const { output } = await build.write(options.rollupConfig.output as OutputOptions)
  const size = prettyBytes(output[0].code.length)
  const zSize = prettyBytes(await gzipSize(output[0].code))
  consola.success('Generated', prettyPath((options.rollupConfig.output as any).file),
    chalk.gray(`(Size: ${size} Gzip: ${zSize})`)
  )

  for (const tmpl of options.templates) {
    let dst = tmpl.dst
    if (typeof dst === 'function') {
      dst = dst(options)
    }
    const dstPath = resolve(options.targetDir, dst)
    await renderTemplate(tmpl.src, dstPath, { options })
    consola.info('Compiled', prettyPath(dstPath))
  }

  await hooks.callHook('done', options)
}
