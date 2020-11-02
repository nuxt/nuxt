import { resolve } from 'path'
import { rollup, OutputOptions } from 'rollup'
import consola from 'consola'
import Hookable from 'hookable'
import defu from 'defu'
import { readFile, writeFile, existsSync } from 'fs-extra'
import prettyBytes from 'pretty-bytes'
import gzipSize from 'gzip-size'
import chalk from 'chalk'
import { getRollupConfig } from './rollup.config'
import { tryImport, hl, prettyPath } from './utils'
import { createDynamicImporter } from './dynamic'

async function main () {
  const rootDir = resolve(process.cwd(), process.argv[2] || '.')

  // Config
  const config = {
    rootDir,
    buildDir: '',
    targets: [],
    nuxt: 2,
    dynamicImporter: undefined,
    importSync: "require('../server/' + chunkId)",
    importAsync: "Promise.resolve(require('../server/' + chunkId))",
    target: process.argv[3] && process.argv[3][0] !== '-' ? process.argv[3] : null,
    minify: process.argv.includes('--minify') ? true : null,
    analyze: process.argv.includes('--analyze') ? true : null,
    logStartup: true
  }
  Object.assign(config, tryImport(rootDir, './nuxt.config')!.deploy)
  config.buildDir = resolve(config.rootDir, config.buildDir || '.nuxt')

  // Ensure dist exists
  if (!existsSync(resolve(config.buildDir, 'dist/server'))) {
    return consola.error('Please use `nuxt build` first to build project!')
  } else {
    consola.success('Using existing nuxt build from', prettyPath(config.buildDir))
  }

  // Ensure relative operations are relative to build dir (fixes rollup dynamic imports)
  process.chdir(config.buildDir)

  // Compile html template
  const htmlTemplateFile = resolve(config.buildDir, `views/${{ 2: 'app', 3: 'document' }[config.nuxt]}.template.html`)
  const htmlTemplateFileJS = htmlTemplateFile.replace(/.html$/, '.js').replace('app.', 'document.')
  const htmlTemplateContents = await readFile(htmlTemplateFile, 'utf-8')
  // eslint-disable-next-line no-template-curly-in-string
  const htmlTemplateCompiled = `export default (params) => \`${htmlTemplateContents.replace(/{{ (\w+) }}/g, '${params.$1}')}\``
  await writeFile(htmlTemplateFileJS, htmlTemplateCompiled)
  consola.info('Generated', prettyPath(htmlTemplateFileJS))

  // Collect dynamic chunks
  if (!config.dynamicImporter) {
    consola.info('Collecting dynamic chunks...')
    config.dynamicImporter = await createDynamicImporter(resolve(config.buildDir, 'dist/server'))
  }

  // Bundle for each target
  for (let target of config.targets) {
    if (typeof target === 'string') {
      target = { target }
    }

    if (config.target && target.target !== config.target) {
      continue
    }

    console.log('\n')
    consola.info(`Generating bundle for ${hl(target.target)}`)

    const ctx: any = defu(
      target,
      config,
      tryImport(__dirname, `./targets/${target.target}`) || tryImport(config.rootDir, target.target)
    )

    const hooks = new Hookable()
    hooks.addHooks(ctx.hooks)

    await hooks.callHook('rollup:prepare', ctx)
    ctx.rollupConfig = getRollupConfig(ctx)
    await hooks.callHook('rollup:config', ctx)

    await hooks.callHook('rollup:before', ctx)
    const build = await rollup(ctx.rollupConfig)
    await hooks.callHook('rollup:built', ctx, build)

    const { output } = await build.write(ctx.rollupConfig.output as OutputOptions)
    const size = prettyBytes(output[0].code.length)
    const zSize = prettyBytes(await gzipSize(output[0].code))
    consola.success('Generated', prettyPath((ctx.rollupConfig.output as any).file),
      chalk.gray(`(Size: ${size} Gzip: ${zSize})`)
    )
    await hooks.callHook('rollup:done', ctx)
  }
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
