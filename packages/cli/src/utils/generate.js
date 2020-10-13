import path, { relative } from 'path'
import upath from 'upath'
import fs from 'fs-extra'
import crc32 from 'crc/lib/crc32'
import consola from 'consola'
import globby from 'globby'
import destr from 'destr'
import { TARGETS } from '@nuxt/utils'

export async function generate (cmd) {
  const nuxt = await getNuxt({ server: true }, cmd)
  const generator = await cmd.getGenerator(nuxt)

  await nuxt.server.listen(0)
  const { errors } = await generator.generate({ build: false })
  await nuxt.close()
  if (cmd.argv['fail-on-error'] && errors.length > 0) {
    throw new Error('Error generating pages, exiting with non-zero code')
  }
}

export async function ensureBuild (cmd) {
  const nuxt = await getNuxt({ _build: true, server: false }, cmd)
  const { options } = nuxt

  if (options.generate.cache === false || destr(process.env.NUXT_BUILD) || cmd.argv['force-build']) {
    const builder = await cmd.getBuilder(nuxt)
    await builder.build()
    await nuxt.close()
    return
  }

  // Default build ignore files
  const ignore = [
    options.buildDir,
    options.dir.static,
    options.generate.dir,
    'node_modules',
    '.**/*',
    '.*',
    'README.md'
  ]

  // Extend ignore
  const { generate } = options
  if (generate.cache.ignore === 'function') {
    generate.cache.ignore = generate.cache.ignore(ignore)
  } else if (Array.isArray(generate.cache.ignore)) {
    generate.cache.ignore = generate.cache.ignore.concat(ignore)
  }
  await nuxt.callHook('generate:cache:ignore', generate.cache.ignore)

  // Take a snapshot of current project
  const snapshotOptions = {
    rootDir: nuxt.options.rootDir,
    ignore: nuxt.options.generate.cache.ignore.map(upath.normalize),
    globbyOptions: nuxt.options.generate.cache.globbyOptions
  }

  const currentBuildSnapshot = await snapshot(snapshotOptions)

  // Detect process.env usage in nuxt.config
  const processEnv = {}
  if (nuxt.options._nuxtConfigFile) {
    const configSrc = await fs.readFile(nuxt.options._nuxtConfigFile)
    const envRegex = /process.env.(\w+)/g
    let match
    // eslint-disable-next-line no-cond-assign
    while (match = envRegex.exec(configSrc)) {
      processEnv[match[1]] = process.env[match[1]]
    }
  }

  // Current build meta
  const currentBuild = {
    // @ts-ignore
    nuxtVersion: nuxt.constructor.version,
    ssr: nuxt.options.ssr,
    target: nuxt.options.target,
    snapshot: currentBuildSnapshot,
    env: nuxt.options.env,
    'process.env': processEnv
  }

  // Check if build can be skipped
  const nuxtBuildFile = path.resolve(nuxt.options.buildDir, 'build.json')
  if (fs.existsSync(nuxtBuildFile)) {
    const previousBuild = destr(fs.readFileSync(nuxtBuildFile, 'utf-8')) || {}

    // Quick diff
    let needBuild = false
    for (const field of ['nuxtVersion', 'ssr', 'target', 'env', 'process.env']) {
      if (JSON.stringify(previousBuild[field]) !== JSON.stringify(currentBuild[field])) {
        needBuild = true
        consola.info(`Doing webpack rebuild because ${field} changed`)
        break
      }
    }

    // Full snapshot diff
    if (!needBuild) {
      const changed = compareSnapshots(previousBuild.snapshot, currentBuild.snapshot)
      if (!changed) {
        consola.success('Skipping webpack build as no changes detected')
        return
      } else {
        consola.info(`Doing webpack rebuild because ${changed} modified`)
      }
    }
  }

  // Webpack build
  const builder = await cmd.getBuilder(nuxt)
  await builder.build()

  // Write build.json
  fs.writeFileSync(nuxtBuildFile, JSON.stringify(currentBuild, null, 2), 'utf-8')

  await nuxt.close()
}

async function getNuxt (args, cmd) {
  const config = await cmd.getNuxtConfig({ dev: false, ...args })

  if (config.target === TARGETS.static) {
    config._export = true
  } else {
    config._legacyGenerate = true
  }
  config.buildDir = (config.static && config.static.cacheDir) || path.resolve(config.rootDir, 'node_modules/.cache/nuxt')
  config.build = config.build || {}
  config.build.transpile = config.build.transpile || []
  if (!config.static || !config.static.cacheDir) {
    config.build.transpile.push('.cache/nuxt')
  }

  const nuxt = await cmd.getNuxt(config)

  return nuxt
}

export function compareSnapshots (from, to) {
  const allKeys = Array.from(new Set([
    ...Object.keys(from).sort(),
    ...Object.keys(to).sort()
  ]))

  for (const key of allKeys) {
    if (JSON.stringify(from[key]) !== JSON.stringify(to[key])) {
      return key
    }
  }

  return false
}

export async function snapshot ({ globbyOptions, ignore, rootDir }) {
  const snapshot = {}

  const files = await globby('**/*.*', {
    ...globbyOptions,
    ignore,
    cwd: rootDir,
    absolute: true
  })

  await Promise.all(files.map(async (p) => {
    const key = relative(rootDir, p)
    try {
      const fileContent = await fs.readFile(p)
      snapshot[key] = {
        checksum: await crc32(fileContent).toString(16)
      }
    } catch (e) {
      // TODO: Check for other errors like permission denied
      snapshot[key] = {
        exists: false
      }
    }
  }))

  return snapshot
}
