import fs from 'fs'
import path, { relative } from 'path'
import crc32 from 'crc/lib/crc32'
import consola from 'consola'
import globby from 'globby'
import destr from 'destr'
import { TARGETS } from '@nuxt/utils'

export async function generate (cmd) {
  const nuxt = await getNuxt({ server: true }, cmd)
  const generator = await cmd.getGenerator(nuxt)

  generator.isFullStatic = nuxt.options.target === TARGETS.static

  generator.initiate = async () => {
    await nuxt.callHook('generate:before', generator, generator.options.generate)
    await nuxt.callHook('export:before', generator)
    await generator.initDist()
  }

  await nuxt.server.listen(0)
  await generator.generate()
  await nuxt.close()
}

export async function ensureBuild (cmd) {
  const nuxt = await getNuxt({ _build: true, server: false }, cmd)
  const { options } = nuxt

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
  if (generate.build.ignore === 'function') {
    generate.build.ignore = generate.build.ignore(ignore)
  } else if (Array.isArray(generate.build.ignore)) {
    generate.build.ignore = generate.build.ignore.concat(ignore)
  }
  await nuxt.callHook('generate:build:ignore', generate.build.ignore)

  // Take a snapshot of current project
  const snapshotOptions = {
    rootDir: nuxt.options.rootDir,
    ignore: nuxt.options.generate.build.ignore,
    globbyOptions: nuxt.options.generate.build.globbyOptions
  }

  const currentBuildSnapshot = await snapshot(snapshotOptions)

  // Current build meta
  const currentBuild = {
    // @ts-ignore
    nuxtVersion: nuxt.constructor.version,
    ssr: nuxt.options.ssr,
    target: nuxt.options.target,
    snapshot: currentBuildSnapshot
  }

  // Check if build can be skipped
  const nuxtBuildFile = path.resolve(nuxt.options.buildDir, 'build.json')
  if (fs.existsSync(nuxtBuildFile)) {
    const previousBuild = destr(fs.readFileSync(nuxtBuildFile, 'utf-8')) || {}

    // Quick diff
    const needBuild = false
    for (const field of ['nuxtVersion', 'ssr', 'target']) {
      if (previousBuild[field] !== currentBuild[field]) {
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

  const nuxt = await cmd.getNuxt(config)

  return nuxt
}

export function compareSnapshots (from, to) {
  const allKeys = Array.from(new Set([
    ...Object.keys(from).sort(),
    ...Object.keys(to).sort()
  ]))

  // const fromKeys = Object.keys(from).sort()
  // const toKeys = Object.keys(to).sort()

  // if (fromKeys.length !== toKeys.length || JSON.stringify(fromKeys) !== JSON.stringify(toKeys)) {
  //   return true
  // }

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
