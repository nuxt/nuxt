import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { createIsIgnored } from '@nuxt/kit'
import type { Nuxt, NuxtConfig, NuxtConfigLayer } from '@nuxt/schema'
import { hash, serialize } from 'ohash'
import { glob } from 'tinyglobby'
import { consola } from 'consola'
import { dirname, join, relative } from 'pathe'
import { createTar, parseTar } from 'nanotar'
import type { TarFileInput } from 'nanotar'

export async function getVueHash (nuxt: Nuxt) {
  const id = 'vue'

  const { hash } = await getHashes(nuxt, {
    id,
    cwd: layer => layer.config?.srcDir,
    patterns: layer => [
      join(relative(layer.cwd, layer.config.srcDir), '**'),
      `!${relative(layer.cwd, layer.config.serverDir || join(layer.cwd, 'server'))}/**`,
      `!${relative(layer.cwd, resolve(layer.config.srcDir || layer.cwd, layer.config.dir?.public || 'public'))}/**`,
      `!${relative(layer.cwd, resolve(layer.config.srcDir || layer.cwd, layer.config.dir?.static || 'public'))}/**`,
      '!node_modules/**',
      '!nuxt.config.*',
    ],
    configOverrides: {
      buildId: undefined,
      serverDir: undefined,
      nitro: undefined,
      devServer: undefined,
      runtimeConfig: undefined,
      logLevel: undefined,
      devServerHandlers: undefined,
      generate: undefined,
      devtools: undefined,
    },
  })

  const cacheFile = join(getCacheDir(nuxt), id, hash + '.tar')

  return {
    hash,
    async collectCache () {
      const start = Date.now()
      await writeCache(nuxt.options.buildDir, nuxt.options.buildDir, cacheFile)
      const elapsed = Date.now() - start
      consola.success(`Cached Vue client and server builds in \`${elapsed}ms\`.`)
    },
    async restoreCache () {
      const start = Date.now()
      const res = await restoreCache(nuxt.options.buildDir, cacheFile)
      const elapsed = Date.now() - start
      if (res) {
        consola.success(`Restored Vue client and server builds from cache in \`${elapsed}ms\`.`)
      }
      return res
    },
  }
}

export async function cleanupCaches (nuxt: Nuxt) {
  const start = Date.now()
  const caches = await glob(['*/*.tar'], {
    cwd: getCacheDir(nuxt),
    absolute: true,
  })
  if (caches.length >= 10) {
    const cachesWithMeta = await Promise.all(caches.map(async (cache) => {
      return [cache, await stat(cache).then(r => r.mtime.getTime()).catch(() => 0)] as const
    }))
    cachesWithMeta.sort((a, b) => a[1] - b[1])
    for (const [cache] of cachesWithMeta.slice(0, cachesWithMeta.length - 10)) {
      await unlink(cache)
    }
    const elapsed = Date.now() - start
    consola.success(`Cleaned up old build caches in \`${elapsed}ms\`.`)
  }
}

// internal

type HashSource = { name: string, data: any }
type Hashes = { hash: string, sources: HashSource[] }

interface GetHashOptions {
  id: string
  cwd: (layer: NuxtConfigLayer) => string
  patterns: (layer: NuxtConfigLayer) => string[]
  configOverrides: Partial<Record<keyof NuxtConfig, unknown>>
}

async function getHashes (nuxt: Nuxt, options: GetHashOptions): Promise<Hashes> {
  if ((nuxt as any)[`_${options.id}BuildHash`]) {
    return (nuxt as any)[`_${options.id}BuildHash`]
  }

  const start = Date.now()
  const hashSources: HashSource[] = []

  // Layers
  let layerCtr = 0
  for (const layer of nuxt.options._layers) {
    if (layer.cwd.includes('node_modules')) { continue }

    const layerName = `layer#${layerCtr++}`
    hashSources.push({
      name: `${layerName}:config`,
      data: serialize({
        ...layer.config,
        ...options.configOverrides || {},
      }),
    })

    const normalizeFiles = (files: Awaited<ReturnType<typeof readFilesRecursive>>) => files.map(f => ({
      name: f.name,
      size: f.attrs?.size,
      data: hash(f.data),
    }))

    const isIgnored = createIsIgnored(nuxt)
    const sourceFiles = await readFilesRecursive(options.cwd(layer), {
      shouldIgnore: isIgnored, // TODO: Validate if works with absolute paths
      cwd: nuxt.options.rootDir,
      patterns: options.patterns(layer),
    })

    hashSources.push({
      name: `${layerName}:src`,
      data: normalizeFiles(sourceFiles),
    })

    const rootFiles = await readFilesRecursive(layer.config?.rootDir || layer.cwd, {
      shouldIgnore: isIgnored, // TODO: Validate if works with absolute paths
      cwd: nuxt.options.rootDir,
      patterns: [
        '.nuxtrc',
        '.npmrc',
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'tsconfig.json',
        'bun.lockb',
      ],
    })

    hashSources.push({
      name: `${layerName}:root`,
      data: normalizeFiles(rootFiles),
    })
  }

  const res = ((nuxt as any)[`_${options.id}BuildHash`] = {
    hash: hash(hashSources),
    sources: hashSources,
  })

  const elapsed = Date.now() - start
  consola.debug(`Computed \`${options.id}\` build hash in \`${elapsed}ms\`.`)

  return res
}

type FileWithMeta = TarFileInput & {
  attrs: {
    mtime: number
    size: number
  }
}

interface ReadFilesRecursiveOptions {
  shouldIgnore?: (name: string) => boolean
  patterns: string[]
  cwd: string
}

async function readFilesRecursive (dir: string | string[], opts: ReadFilesRecursiveOptions): Promise<FileWithMeta[]> {
  if (Array.isArray(dir)) {
    return (await Promise.all(dir.map(d => readFilesRecursive(d, opts)))).flat()
  }

  const files = await glob(opts.patterns, { cwd: dir })

  const fileEntries = await Promise.all(files.map(async (fileName) => {
    if (!opts.shouldIgnore?.(fileName)) {
      const file = await readFileWithMeta(dir, fileName)
      if (!file) { return }
      return {
        ...file,
        name: relative(opts.cwd, join(dir, file.name)),
      }
    }
  }))

  return fileEntries.filter(Boolean) as FileWithMeta[]
}

async function readFileWithMeta (dir: string, fileName: string, count = 0): Promise<FileWithMeta | undefined> {
  let fd: FileHandle | undefined = undefined

  try {
    fd = await open(resolve(dir, fileName))
    const stats = await fd.stat()

    if (!stats?.isFile()) { return }

    const mtime = stats.mtime.getTime()
    const data = await fd.readFile()

    // retry if file has changed during read
    if ((await fd.stat()).mtime.getTime() !== mtime) {
      if (count < 5) {
        return readFileWithMeta(dir, fileName, count + 1)
      }
      console.warn(`Failed to read file \`${fileName}\` as it changed during read.`)
      return
    }

    return {
      name: fileName,
      data,
      attrs: {
        mtime,
        size: stats.size,
      },
    }
  } catch (err) {
    console.warn(`Failed to read file \`${fileName}\`:`, err)
  } finally {
    await fd?.close()
  }
}

async function restoreCache (cwd: string, cacheFile: string) {
  if (!existsSync(cacheFile)) {
    return false
  }

  const files = parseTar(await readFile(cacheFile))
  for (const file of files) {
    let fd: FileHandle | undefined = undefined
    try {
      const filePath = resolve(cwd, file.name)
      await mkdir(dirname(filePath), { recursive: true })

      fd = await open(filePath, 'w')

      const stats = await fd.stat().catch(() => null)
      if (stats?.isFile() && stats.size) {
        const lastModified = Number.parseInt(file.attrs?.mtime?.toString().padEnd(13, '0') || '0')
        if (stats.mtime.getTime() >= lastModified) {
          consola.debug(`Skipping \`${file.name}\` (up to date or newer than cache)`)
          continue
        }
      }
      await fd.writeFile(file.data!)
    } catch (err) {
      console.error(err)
    } finally {
      await fd?.close()
    }
  }
  return true
}

async function writeCache (cwd: string, sources: string | string[], cacheFile: string) {
  const fileEntries = await readFilesRecursive(sources, {
    patterns: ['**/*', '!analyze/**'],
    cwd,
  })
  const tarData = createTar(fileEntries)
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, tarData)
}

function getCacheDir (nuxt: Nuxt) {
  let cacheDir = join(nuxt.options.workspaceDir, 'node_modules')
  if (!existsSync(cacheDir)) {
    for (const dir of [...nuxt.options.modulesDir].sort((a, b) => a.length - b.length)) {
      if (existsSync(dir)) {
        cacheDir = dir
        break
      }
    }
  }
  return join(cacheDir, '.cache/nuxt/builds')
}
