import { open } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { resolve } from 'node:path'
import { isIgnored } from '@nuxt/kit'
import type { Nuxt, NuxtConfig, NuxtConfigLayer } from '@nuxt/schema'
import { hash, murmurHash, objectHash } from 'ohash'
import { glob } from 'tinyglobby'
import _consola from 'consola'
import { isAbsolute, join, relative } from 'pathe'

type HashSource = { name: string, data: any }
type Hashes = { hash: string, sources: HashSource[] }

interface GetHashOptions {
  id: string
  cwd: (layer: NuxtConfigLayer) => string
  patterns: (layer: NuxtConfigLayer) => string[]
  configOverrides: Partial<Record<keyof NuxtConfig, undefined>>
}

async function getHashes (nuxt: Nuxt, options: GetHashOptions): Promise<Hashes> {
  if ((nuxt as any)[`_${options.id}`]) {
    return (nuxt as any)[`_${options.id}`]
  }

  const hashSources: HashSource[] = []

  // Layers
  let layerCtr = 0
  for (const layer of nuxt.options._layers) {
    if (layer.cwd.includes('node_modules')) {
      continue
    }
    const layerName = `layer#${layerCtr++}`
    hashSources.push({
      name: `${layerName}:config`,
      data: objectHash({
        ...layer.config,
        ...options.configOverrides || {},
      }),
    })

    const normalizeFiles = (files: Awaited<ReturnType<typeof readFilesRecursive>>) => files.map(f => ({
      name: f.name,
      size: (f.attrs as any)?.size,
      data: murmurHash(f.data as any /* ArrayBuffer */),
    }))

    const sourceFiles = await readFilesRecursive(options.cwd(layer), {
      shouldIgnore: isIgnored, // TODO: Validate if works with absolute paths
      patterns: options.patterns(layer),
    })

    hashSources.push({
      name: `${layerName}:src`,
      data: normalizeFiles(sourceFiles),
    })

    const rootFiles = await readFilesRecursive(layer.config?.rootDir || layer.cwd, {
      shouldIgnore: isIgnored, // TODO: Validate if works with absolute paths
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

  const res = ((nuxt as any)[`_${options.id}`] = {
    hash: hash(hashSources),
    sources: hashSources,
  })

  return res
}

type FileWithMeta = {
  name: string
  data?: Buffer
  attrs: {
    mtime: number
    size: number
  }
}

interface ReadFilesRecursiveOptions {
  shouldIgnore?: (name: string) => boolean
  noData?: boolean
  patterns: string[]
}

async function readFilesRecursive (dir: string | string[], opts: ReadFilesRecursiveOptions): Promise<FileWithMeta[]> {
  if (Array.isArray(dir)) {
    return (await Promise.all(dir.map(d => readFilesRecursive(d, opts)))).flat()
  }

  const files = await glob(opts.patterns, {
    cwd: dir,
  })

  const fileEntries = await Promise.all(
    files.map((fileName) => {
      if (!opts.shouldIgnore?.(fileName)) {
        return readFileWithMeta(dir, fileName)
      }
    }),
  )

  return fileEntries.filter(Boolean) as FileWithMeta[]
}

async function readFileWithMeta (dir: string, fileName: string, count = 0): Promise<FileWithMeta | undefined> {
  let file: FileHandle | undefined = undefined

  try {
    file = await open(resolve(dir, fileName))
    const stats = await file.stat()

    if (!stats?.isFile()) { return }

    const mtime = stats.mtime.getTime()
    const data = await file.readFile()

    // retry if file has changed during read
    if ((await file.stat()).mtime.getTime() !== mtime) {
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
    await file?.close()
  }
}

export function getVueHash (nuxt: Nuxt) {
  return getHashes(nuxt, {
    id: 'vueBuildHash',
    cwd: layer => layer.config?.srcDir,
    patterns: layer => [
      join(relative(layer.cwd, layer.config.srcDir), '**'),
      `!${join(relative(layer.cwd, layer.config.serverDir || 'server'), '**')}/**`,
      `!${relative(layer.cwd, resolve(nuxt.options.srcDir, nuxt.options.dir.public))}/**`,
      `!${relative(layer.cwd, resolve(nuxt.options.srcDir, nuxt.options.dir.static))}/**`,
      '!node_modules/**',
      '!nuxt.config.*',
    ],
    configOverrides: {
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
}

export function getNitroHash (nuxt: Nuxt) {
  return getHashes(nuxt, {
    id: 'nitroBuildHash',
    cwd: layer => layer.cwd,
    patterns: layer => [
      relative(layer.cwd, join(nuxt.options.serverDir, '**')),
      relative(layer.cwd, join(nuxt.options.buildDir, 'dist/server/**')),
      ...Object.values({
        ...nuxt.options.dir,
        ...layer.config.dir,
        public: undefined,
        static: undefined,
      }).filter(Boolean).map(dir => isAbsolute(dir!) ? `!${relative(layer.cwd, dir!)}/**` : `!${dir}/**`),
      `${relative(layer.cwd, resolve(nuxt.options.srcDir, nuxt.options.dir.public))}/**`,
      `${relative(layer.cwd, resolve(nuxt.options.srcDir, nuxt.options.dir.static))}/**`,
    ],
    configOverrides: {
      vite: undefined,
      webpack: undefined,
      postcss: undefined,
    },
  })
}
