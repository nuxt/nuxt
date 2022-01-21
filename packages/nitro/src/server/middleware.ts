import { resolve, join, extname } from 'pathe'
import { joinURL } from 'ufo'
import { globby } from 'globby'
import { watch } from 'chokidar'
import { tryResolveModule, tryResolvePath } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { Middleware } from 'h3'

export interface ServerMiddleware {
  route: string
  /**
   * @deprecated use route
   */
  path?: string

  handle?: Middleware | string
  /**
   * @deprecated use handle
   */
  handler?: Middleware | string

  lazy?: boolean // Default is true
  promisify?: boolean // Default is true
}

function filesToMiddleware (files: string[], baseDir: string, baseURL: string, overrides?: Partial<ServerMiddleware>): ServerMiddleware[] {
  return files.map((file) => {
    const route = joinURL(
      baseURL,
      file
        .slice(0, file.length - extname(file).length)
        .replace(/\/index$/, '')
    )
    const handle = resolve(baseDir, file)
    return {
      route,
      handle
    }
  })
    .sort((a, b) => b.route.localeCompare(a.route))
    .map(m => ({ ...m, ...overrides }))
}

export function scanMiddleware (serverDir: string, onChange?: (results: ServerMiddleware[], event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', file: string) => void): Promise<ServerMiddleware[]> {
  const pattern = '**/*.{ts,mjs,js,cjs}'
  const globalDir = resolve(serverDir, 'middleware')
  const apiDir = resolve(serverDir, 'api')

  const scan = async () => {
    const globalFiles = await globby(pattern, { cwd: globalDir, dot: true })
    const apiFiles = await globby(pattern, { cwd: apiDir, dot: true })
    return [
      ...filesToMiddleware(globalFiles, globalDir, '/', { route: '/' }),
      ...filesToMiddleware(apiFiles, apiDir, '/api', { lazy: true })
    ]
  }

  if (typeof onChange === 'function') {
    const watcher = watch([
      join(globalDir, pattern),
      join(apiDir, pattern)
    ], { ignoreInitial: true })
    watcher.on('all', async (event, file) => {
      onChange(await scan(), event, file)
    })
  }

  return scan()
}

export function resolveMiddleware (nuxt: Nuxt) {
  const middleware: ServerMiddleware[] = []
  const legacyMiddleware: ServerMiddleware[] = []

  for (let m of nuxt.options.serverMiddleware) {
    if (typeof m === 'string' || typeof m === 'function' /* legacy middleware */) { m = { handler: m } }
    const route = m.path || m.route || '/'
    const handle = m.handler || m.handle
    if (typeof handle !== 'string' || typeof route !== 'string') {
      legacyMiddleware.push(m)
    } else {
      delete m.handler
      delete m.path
      middleware.push({
        ...m,
        handle: tryResolvePath(handle, {
          extensions: ['.ts', '.mjs', '.js', '.cjs'],
          alias: nuxt.options.alias,
          base: nuxt.options.srcDir
        }) || tryResolveModule(handle, { paths: nuxt.options.modulesDir }),
        route
      })
    }
  }

  return {
    middleware,
    legacyMiddleware
  }
}
