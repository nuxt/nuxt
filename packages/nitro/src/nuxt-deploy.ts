import { resolve } from 'path'
import { rollup, OutputOptions } from 'rollup'
import consola from 'consola'
import Hookable from 'hookable'
import defu from 'defu'
import { existsSync, copy, emptyDir } from 'fs-extra'
import prettyBytes from 'pretty-bytes'
import gzipSize from 'gzip-size'
import chalk from 'chalk'
import { getRollupConfig } from './rollup.config'
import { tryImport, hl, prettyPath, compileTemplateToJS, renderTemplate } from './utils'

async function main () {
  const rootDir = resolve(process.cwd(), process.argv[2] || '.')

  // Config
  const config = {
    rootDir,
    buildDir: '',
    targets: [],
    templates: [],
    nuxt: 2,
    target: process.argv[3] && process.argv[3][0] !== '-' ? process.argv[3] : null,
    minify: process.argv.includes('--minify') ? true : null,
    analyze: process.argv.includes('--analyze') ? true : null,
    logStartup: true
  }

  Object.assign(config, tryImport(rootDir, './nuxt.config')!.deploy)

  config.buildDir = resolve(config.rootDir, config.buildDir || '.nuxt')

  config.targets = config.targets.map(t => typeof t === 'string' ? { target: t } : t)
  if (config.target && !config.targets.find(t => t.target === config.target)) {
    config.targets.push({ target: config.target })
  }

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
  await compileTemplateToJS(htmlTemplateFile, htmlTemplateFileJS)
  consola.info('Generated', prettyPath(htmlTemplateFileJS))

  // Bundle for each target
  for (let target of config.targets) {
    if (typeof target === 'string') {
      target = { target }
    }

    if (config.target && target.target !== config.target) {
      continue
    }

    consola.info(`Generating bundle for ${hl(target.target)}`)

    const _config: any = defu(
      // Target specific config by user
      target,
      // Global user config
      config,
      // Target defaults
      tryImport(__dirname, `./targets/${target.target}`) || tryImport(config.rootDir, target.target),
      // Generic defaults
      { outDir: resolve(config.buildDir, `dist/${target.target}`), outName: 'index.js' }
    )

    const hooks = new Hookable()
    hooks.addHooks(_config.hooks)

    await hooks.callHook('config', _config)

    emptyDir(_config.outDir)

    _config.rollupConfig = getRollupConfig(_config)
    await hooks.callHook('rollup:before', _config)
    const build = await rollup(_config.rollupConfig)

    const { output } = await build.write(_config.rollupConfig.output as OutputOptions)
    const size = prettyBytes(output[0].code.length)
    const zSize = prettyBytes(await gzipSize(output[0].code))
    consola.success('Generated', prettyPath((_config.rollupConfig.output as any).file),
      chalk.gray(`(Size: ${size} Gzip: ${zSize})`)
    )

    for (const tmpl of _config.templates) {
      const dstPath = resolve(_config.outDir, tmpl.dst)
      await renderTemplate(tmpl.src, dstPath, { config: _config })
      consola.info('Compiled', prettyPath(dstPath))
    }

    if (_config.copyAssets) {
      const publicDir = typeof _config.copyAssets === 'string' ? _config.copyAssets : 'public'
      const dst = resolve(_config.outDir, publicDir, '_nuxt')
      await copy(resolve(_config.buildDir, 'dist/client'), dst)
      consola.info('Copied public assets to', prettyPath(dst))
    }

    await hooks.callHook('done', _config)
  }
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
