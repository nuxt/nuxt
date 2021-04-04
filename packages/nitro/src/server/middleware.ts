import { resolve, join, extname } from 'upath'
import { joinURL } from 'ufo'
import globby from 'globby'
import { watch } from 'chokidar'
import type { Middleware } from 'h3'
import { tryResolvePath, Nuxt } from '@nuxt/kit'

export interface ServerMiddleware {
  route: string
  /**
   * @deprecated use route
   */
  path?: string

  handle?: Middleware
  /**
   * @deprecated use handle
   */
  handler?: Middleware

  lazy?: boolean // Default is true
  promisify?: boolean // Default is true
}

function filesToMiddleware (files: string[], baseDir: string, basePath: string, overrides?: Partial<ServerMiddleware>): ServerMiddleware[] {
  return files.map((file) => {
    const route = joinURL(basePath, file.substr(0, file.length - extname(file).length))
    const handle = resolve(baseDir, file)
    return {
      route,
      handle
    }
  })
    .sort((a, b) => a.route.localeCompare(b.route))
    .map(m => ({ ...m, ...overrides }))
}

export function scanMiddleware (serverDir: string, onChange?: (results: ServerMiddleware[], event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', file: string) => void): Promise<ServerMiddleware[]> {
  const pattern = '**/*.{js,ts}'
  const globalDir = resolve(serverDir, 'middleware')
  const apiDir = resolve(serverDir, 'api')

  const scan = async () => {
    const globalFiles = await globby(pattern, { cwd: globalDir })
    const apiFiles = await globby(pattern, { cwd: apiDir })
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
    if (typeof m === 'string') { m = { handler: m } }
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
          extensions: ['.ts', '.js'],
          alias: nuxt.options.alias,
          base: nuxt.options.srcDir
        }),
        route
      })
    }
  }

  return {
    middleware,
    legacyMiddleware
  }
}
