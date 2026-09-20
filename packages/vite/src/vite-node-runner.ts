import { ViteNodeRunner } from 'vite-node/client'

import { consola } from 'consola'
import { parseInlineSourceMap } from 'my-bad'
import type { RawSourceMap } from 'my-bad'
import { generatedPosition, originalPosition, resolveSource, traceMapFor as traceMap } from 'nuxt/internal/dev-error/sourcemap'
import type { SourcePosition, TraceMap } from 'nuxt/internal/dev-error/sourcemap'
import { viteNodeFetch, viteNodeOptions } from '#vite-node'
import process from 'node:process'

const runner: ViteNodeRunner = createRunner()

// stacks raised in a transformed module arrive mapped, rather than being rewritten later
Error.prepareStackTrace = prepareStackTrace

/** Transformed code of a module as it was evaluated, if the runner still holds it. */
export function getCode (file: string): string | undefined {
  return moduleCacheFor(file)?.code
}

/** The runner's entry for `file`, without creating one for a file it never evaluated. */
function moduleCacheFor (file: string): ReturnType<ViteNodeRunner['moduleCache']['get']> | undefined {
  const id = runner.moduleCache.normalizePath(file)
  return runner.moduleCache.has(id) ? runner.moduleCache.getByModuleId(id) : undefined
}

const parsedMaps = new WeakMap<object, { code: string, map: RawSourceMap | undefined }>()

/**
 * The inline map of the code the runner holds for `file`. Vite inlines it without the
 * charset `moduleCache.getSourceMap` expects, and a re-evaluated module keeps its entry.
 */
function sourceMapFor (file: string): RawSourceMap | undefined {
  try {
    const cache = moduleCacheFor(file)
    if (!cache?.code) {
      return undefined
    }
    let parsed = parsedMaps.get(cache)
    if (parsed?.code !== cache.code) {
      parsed = { code: cache.code, map: parseInlineSourceMap(cache.code) ?? undefined }
      parsedMaps.set(cache, parsed)
    }
    return parsed.map
  } catch {
    return undefined
  }
}

/** The map of `file` as the runner holds it now, so an edited module maps through its own map. */
function traceMapFor (file: string): TraceMap | undefined {
  const map = sourceMapFor(file)
  return map ? traceMap(map, file) : undefined
}

/** Source position a position in the transformed code came from, 1-based as in a stack. */
export function getOriginalPosition (file: string, line: number, column: number): SourcePosition | undefined {
  const trace = traceMapFor(file)
  return trace && originalPosition(trace, line, column)
}

/** Position in the transformed code a source position was mapped from, 1-based as in a stack. */
export function getCompiledPosition (file: string, line: number, column?: number): SourcePosition | undefined {
  const trace = traceMapFor(file)
  const source = trace && resolveSource(trace, file)
  const position = source ? generatedPosition(trace, source, line, column) : undefined
  return position && { file, ...position }
}

/**
 * Formats a stack as V8 does, with the position of each frame in a transformed module
 * replaced by the source position its current map gives it.
 */
export function prepareStackTrace (error: Error, callSites: NodeJS.CallSite[]): string {
  const frames = callSites.map((callSite) => {
    const text = `    at ${callSite.toString()}`
    const file = callSite.getFileName()
    const line = callSite.getLineNumber()
    const column = callSite.getColumnNumber()
    if (!file || line === null || column === null) {
      return text
    }
    const mapped = getOriginalPosition(file, line, column)
    if (!mapped) {
      return text
    }
    const compiled = `${file}:${line}:${column}`
    const index = text.lastIndexOf(compiled)
    return index === -1 ? text : `${text.slice(0, index)}${mapped.file}:${mapped.line}:${mapped.column}${text.slice(index + compiled.length)}`
  })
  return [headerOf(error), ...frames].join('\n')
}

function headerOf (error: Error): string {
  try {
    const name = error.name === undefined ? 'Error' : String(error.name)
    const message = error.message === undefined ? '' : String(error.message)
    return !message ? name : !name ? message : `${name}: ${message}`
  } catch {
    return 'Error'
  }
}

function createRunner () {
  return new ViteNodeRunner({
    root: viteNodeOptions.root, // Equals to Nuxt `srcDir`
    base: viteNodeOptions.base,
    resolveId (id, importer) {
      return viteNodeFetch.resolveId(id, importer)
    },
    fetchModule (id) {
      id = id.replace(/\/\//g, '/') // TODO: fix in vite-node
      return viteNodeFetch.fetchModule(id).catch((err) => {
        const errorData = err?.data
        if (!errorData) {
          throw err
        }
        let built: Error
        try {
          built = buildViteError(errorData, id)
        } catch (buildErr) {
          consola.warn('Internal nuxt error while formatting vite-node error. Please report this!', buildErr)
          const message = `[vite-node] [TransformError] ${errorData?.message || '-'}`
          consola.error(message, errorData)
          built = Object.assign(new Error(message), {
            statusText: 'Vite Error',
            statusMessage: 'Vite Error',
            stack: `${message}\nat ${id}\n` + (errorData?.stack || ''),
          })
        }
        throw built
      })
    },
  })
}

export interface ViteNodeErrorLocation {
  file?: string
  line?: number
  column?: number
}

export interface ViteNodeErrorData {
  code?: string
  /** The compiler's own error name, when it has one. */
  name?: string
  id?: string
  message?: string
  stack?: string
  frame?: string
  loc?: ViteNodeErrorLocation
  plugin?: string
  pluginCode?: string
}

/** `[plugin]` or `[scope/plugin]`, as vite and its plugins prefix a message. */
const PLUGIN_PREFIX_RE = /^\[@?[\w.\-/:]+\]\s*/

/** `path/to/file.vue:1:2 `, as a compiler repeats a position it also attaches to the error. */
const MESSAGE_PREFIX_POSITION_RE = /^\S+:\d+(?::\d+)?\s+/

/** Error thrown when Vite fails to transform an SSR module. */
export interface ViteNodeError extends Error {
  code?: string
  frame?: string
  id?: string
  loc?: ViteNodeErrorLocation
  plugin?: string
  pluginCode?: string
}

export function buildViteError (errorData: ViteNodeErrorData, id: string): ViteNodeError {
  const file = (errorData.loc?.file || errorData.id || id || '').replace(process.cwd(), '.')

  // vite and compilers such as @vue/compiler-sfc prefix a message with `[scope/plugin]` and
  // the position, and append a code frame after a blank line; the report draws both from `loc`
  const rawMessage: string = errorData.message || ''
  const [headRaw, ...frameTail] = rawMessage.split(/\r?\n\s*\n/)
  const head = ((headRaw || '').split(/\r?\n/)[0] ?? '').replace(PLUGIN_PREFIX_RE, '')
  // the position is only dropped from the message when `loc` already carries it
  const reason = (errorData.loc?.line === undefined ? head : head.replace(MESSAGE_PREFIX_POSITION_RE, '')).trim()
  const messageFrame = frameTail.length ? frameTail.join('\n\n').trim() : ''

  const located = errorData.loc?.line !== undefined || reason.includes(file)
  const message = reason ? (located ? reason : `${reason} (${file})`) : (rawMessage || file)

  const error = Object.assign(new Error(message), {
    name: errorData.name || 'ViteError',
    statusText: 'Vite Error',
    statusMessage: 'Vite Error',
    code: errorData.code,
    frame: errorData.frame || messageFrame || undefined,
    id: errorData.id || id,
    ...errorData.loc && { loc: errorData.loc },
    ...errorData.plugin && { plugin: errorData.plugin },
    ...errorData.pluginCode && { pluginCode: errorData.pluginCode },
  }) satisfies ViteNodeError

  // the stack of the compiler that failed, rather than of this runner
  if (errorData.stack) {
    error.stack = errorData.stack
  }

  return error
}

export default runner
