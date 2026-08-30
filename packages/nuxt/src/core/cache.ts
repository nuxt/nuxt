import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createIsIgnored, setBuildOutput } from '@nuxt/kit'
import { buildDiagnostics, useServerBuild } from '@nuxt/kit/internal'
import type { Nuxt, NuxtBuildOutputs, NuxtConfig, NuxtConfigLayer } from '@nuxt/schema'
import { hash, serialize } from 'ohash'
import { glob } from 'tinyglobby'
import { consola } from 'consola'
import { dirname, join, relative, resolve } from 'pathe'
import { createTar, parseTar } from 'nanotar'
import type { TarFileInput } from 'nanotar'
import type { Plugin as VitePlugin } from 'vite'

export async function getVueHash (nuxt: Nuxt) {
  const id = 'vue'

  const { hash } = await getHashes(nuxt, {
    id,
    cwd: layer => layer.config.srcDir || layer.cwd,
    patterns: (layer) => {
      const srcDir = layer.config.srcDir || layer.cwd
      return [
        '**',
        `!${relative(srcDir, layer.config.serverDir || join(layer.cwd, 'server'))}/**`,
        `!${relative(srcDir, resolve(layer.cwd, layer.config.dir?.public || 'public'))}/**`,
        '!node_modules/**',
        '!nuxt.config.*',
      ]
    },
    configOverrides: {
      buildId: undefined,
      serverDir: undefined,
      nitro: undefined,
      devServer: undefined,
      runtimeConfig: undefined,
      logLevel: undefined,
      devServerHandlers: undefined,
      devtools: undefined,
    },
  })

  const cacheFile = join(getCacheDir(nuxt), id, hash + '.tar')
  const buildIdCacheFile = cacheFile.replace('.tar', '.buildid')
  const clientCacheFile = cacheFile.replace('.tar', '.client.tar')

  // When Nitro builds as a Vite environment the client bundle is written to
  // `output.publicDir`, outside `buildDir`, so it needs its own cache entry.
  const cachesClientAssets = nuxt.options.experimental.nitroViteEnvironment
  let clientFiles: string[] = []

  return {
    hash,
    async collectCache () {
      const start = Date.now()
      await persistBuildOutputs(nuxt)
      await writeCache(nuxt.options.buildDir, nuxt.options.buildDir, cacheFile)
      if (cachesClientAssets && clientFiles.length) {
        const publicDir = useServerBuild(nuxt).output.publicDir()
        await writeCache(publicDir, publicDir, clientCacheFile, clientFiles)
      }

      // Cache buildId so it can be restored before modules are initialised on the next build
      await mkdir(dirname(buildIdCacheFile), { recursive: true })
      await writeFile(buildIdCacheFile, nuxt.options.buildId)

      const elapsed = Date.now() - start
      consola.success(`Cached Vue client and server builds in \`${elapsed}ms\`.`)
    },
    async restoreCache () {
      const start = Date.now()
      if (cachesClientAssets && !existsSync(clientCacheFile)) {
        return false
      }
      const res = await restoreCacheFromFile(nuxt.options.buildDir, cacheFile)
      const elapsed = Date.now() - start
      if (res) {
        await restoreBuildOutputs(nuxt)
        consola.success(`Restored Vue client and server builds from cache in \`${elapsed}ms\`.`)
      }
      return res
    },
    clientCachePlugin (options: { restore: boolean }): VitePlugin {
      return {
        name: 'nuxt:build-cache:client',
        sharedDuringBuild: true,
        // On a cache miss, record exactly what the client build emitted so the
        // same set can be replayed on a hit: the bundle is written to
        // `output.publicDir`, which by then also holds copied public assets and
        // prerendered pages that must not be cached.
        writeBundle (_options, bundle) {
          if (this.environment?.name === 'client') {
            clientFiles = Object.keys(bundle)
          }
        },
        // Nitro still needs to build on a cache hit, to prerender and to emit
        // `.output/server`. Its orchestrator skips any environment reporting
        // `isBuilt`, so flagging the client environment leaves the ssr and
        // nitro environments to build as usual.
        //
        // Restoring here rather than before the build starts is deliberate:
        // nitro empties `output.publicDir` from its own `buildApp` hook, which
        // is ordered `pre` and so runs first.
        ...options.restore
          ? {
              async buildApp (builder) {
                await restoreCacheFromFile(useServerBuild(nuxt).output.publicDir(), clientCacheFile)
                await restoreBuildOutputs(nuxt, CLIENT_BUILD_OUTPUT_KEYS)
                const client = builder.environments.client
                if (client) {
                  client.isBuilt = true
                }
              },
            }
          : {},
      }
    },
  }
}

const BUILD_OUTPUTS_FILE = 'build-outputs.json'

/**
 * The bundler is skipped entirely on a cache hit, so the `nuxt/*` build outputs
 * it would normally provide are snapshotted into the cached build directory and
 * replayed on restore.
 */
async function persistBuildOutputs (nuxt: Nuxt) {
  const outputs: Partial<Record<keyof NuxtBuildOutputs, string>> = {}
  for (const key of Object.keys(nuxt.buildOutputs) as Array<keyof NuxtBuildOutputs>) {
    outputs[key] = String(await nuxt.buildOutputs[key]())
  }
  await writeFile(resolve(nuxt.options.buildDir, BUILD_OUTPUTS_FILE), JSON.stringify(outputs), 'utf8')
}

async function restoreBuildOutputs (nuxt: Nuxt, keys?: ReadonlyArray<keyof NuxtBuildOutputs>) {
  const file = resolve(nuxt.options.buildDir, BUILD_OUTPUTS_FILE)
  if (!existsSync(file)) { return }
  const outputs = JSON.parse(await readFile(file, 'utf8')) as Record<keyof NuxtBuildOutputs, string>
  for (const key of Object.keys(outputs) as Array<keyof NuxtBuildOutputs>) {
    if (keys && !keys.includes(key)) { continue }
    const code = outputs[key]
    setBuildOutput(key, () => code, nuxt)
  }
}

/**
 * Outputs the client build is the sole source of. Their providers are
 * registered when the client environment's plugins are created, which happens
 * after the cache is restored, so they have to be replayed once the build has
 * started or the stub values would win.
 */
const CLIENT_BUILD_OUTPUT_KEYS = ['clientManifest', 'clientPrecomputed', 'entryChunkName'] as const

/**
 * Restore cached buildId before modules are initialised.
 *
 * Modules and the nitro builder require `buildId`, so we must set
 * `nuxt.options.buildId` and `nuxt.options.runtimeConfig.app.buildId`
 * before modules install. This ensures the manifest and all downstream
 * consumers use the same buildId that was used when the Vue build was cached.
 */
export async function restoreCachedBuildId (nuxt: Nuxt) {
  const { hash } = await getVueHash(nuxt)
  const cacheDir = getCacheDir(nuxt)
  const buildIdCacheFile = join(cacheDir, 'vue', hash + '.buildid')

  if (!existsSync(buildIdCacheFile)) {
    return
  }

  const cachedBuildId = (await readFile(buildIdCacheFile, 'utf-8')).trim()
  if (!cachedBuildId || !/^[\w-]+$/.test(cachedBuildId)) {
    return
  }

  nuxt.options.buildId = cachedBuildId
  nuxt.options.runtimeConfig.app.buildId = cachedBuildId
  consola.debug(`Restored cached buildId: ${cachedBuildId}`)
}

export async function cleanupCaches (nuxt: Nuxt) {
  const start = Date.now()
  const caches = await glob(['*/*.tar', '*/*.buildid'], {
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
    })).sort((a, b) => a.name.localeCompare(b.name))

    const isIgnored = createIsIgnored(nuxt)
    const sourceFiles = await readFilesRecursive(options.cwd(layer), {
      shouldIgnore: isIgnored,
      cwd: nuxt.options.rootDir,
      patterns: options.patterns(layer),
    })

    hashSources.push({
      name: `${layerName}:src`,
      data: normalizeFiles(sourceFiles),
    })

    const rootFiles = await readFilesRecursive(layer.config?.rootDir || layer.cwd, {
      shouldIgnore: isIgnored,
      cwd: nuxt.options.rootDir,
      patterns: [
        '.nuxtrc',
        '.npmrc',
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'tsconfig.json',
        'bun.lock',
        'bun.lockb',
      ],
    })

    hashSources.push({
      name: `${layerName}:root`,
      data: normalizeFiles(rootFiles),
    })
  }

  hashSources.sort((a, b) => a.name.localeCompare(b.name))

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
  /** Called with the absolute path of each matched file. */
  shouldIgnore?: (path: string) => boolean
  patterns: string[]
  cwd: string
}

async function readFilesRecursive (dir: string | string[], opts: ReadFilesRecursiveOptions): Promise<FileWithMeta[]> {
  if (Array.isArray(dir)) {
    return (await Promise.all(dir.map(d => readFilesRecursive(d, opts)))).flat()
  }

  const files = await glob(opts.patterns, { cwd: dir })

  const fileEntries = await Promise.all(files.map(async (fileName) => {
    if (!opts.shouldIgnore?.(resolve(dir, fileName))) {
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
      await fd.close()
      fd = undefined
      if (count < 5) {
        return await readFileWithMeta(dir, fileName, count + 1)
      }
      buildDiagnostics.NUXT_B1010({ file: fileName })
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
    buildDiagnostics.NUXT_B1011({ file: fileName, cause: err })
  } finally {
    await fd?.close()
  }
}

async function restoreCacheFromFile (cwd: string, cacheFile: string) {
  if (!existsSync(cacheFile)) {
    return false
  }

  const resolvedCwd = resolve(cwd) + '/'
  const files = parseTar(await readFile(cacheFile))
  for (const file of files) {
    let fd: FileHandle | undefined = undefined
    try {
      const filePath = resolve(cwd, file.name)

      // Prevent path traversal attacks
      if (!filePath.startsWith(resolvedCwd)) {
        buildDiagnostics.NUXT_B1012({ path: file.name })
        continue
      }

      await mkdir(dirname(filePath), { recursive: true })

      // Stat before open('w') since it truncates the file
      const existingStats = await stat(filePath).catch(() => null)
      const cachedSize = file.data?.byteLength ?? 0
      if (existingStats?.isFile() && existingStats.size === cachedSize) {
        const lastModified = Number.parseInt(file.attrs?.mtime?.toString().padEnd(13, '0') || '0')
        if (existingStats.mtime.getTime() >= lastModified) {
          consola.debug(`Skipping \`${file.name}\` (up to date or newer than cache)`)
          continue
        }
      }

      fd = await open(filePath, 'w')
      await fd.writeFile(file.data!)
    } catch (err) {
      buildDiagnostics.NUXT_B1013({ file: file.name, cause: err })
    } finally {
      await fd?.close()
    }
  }
  return true
}

async function writeCache (cwd: string, sources: string | string[], cacheFile: string, patterns = ['**/*', '!analyze/**']) {
  const fileEntries = await readFilesRecursive(sources, {
    patterns,
    cwd,
  })
  const tarData = createTar(fileEntries)
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, tarData)
}

function getCacheDir (nuxt: Nuxt) {
  let cacheDir = join(nuxt.options.workspaceDir, 'node_modules')
  if (!existsSync(cacheDir)) {
    for (const dir of nuxt.options.modulesDir.toSorted((a, b) => a.length - b.length)) {
      if (existsSync(dir)) {
        cacheDir = dir
        break
      }
    }
  }
  return join(cacheDir, '.cache/nuxt/builds')
}
