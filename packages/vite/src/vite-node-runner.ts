import { ViteNodeRunner } from 'vite-node/client'
import { installSourcemapsSupport } from 'vite-node/source-map'

import { consola } from 'consola'
import { parseInlineSourceMap } from 'my-bad'
import type { RawSourceMap } from 'my-bad'
import { GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND, TraceMap, generatedPositionFor } from '@jridgewell/trace-mapping'
import type { EncodedSourceMap } from '@jridgewell/trace-mapping'
import { viteNodeFetch, viteNodeOptions } from '#vite-node'
import process from 'node:process'

const runner: ViteNodeRunner = createRunner()

// stacks raised in a transformed module arrive mapped, rather than being rewritten later
installSourcemapsSupport({ getSourceMap: file => encoded(sourceMapFor(file)) })

/** Transformed code of a module as it was evaluated, if the runner still holds it. */
export function getCode (file: string): string | undefined {
  try {
    return runner.moduleCache.get(file).code
  } catch {
    return undefined
  }
}

/** `RawSourceMap` leaves `version` and `names` optional, which both consumers require. */
function encoded (map: RawSourceMap | undefined): EncodedSourceMap | null {
  return map ? { version: 3, names: [], ...map } as EncodedSourceMap : null
}

/** Vite inlines the map without the charset `moduleCache.getSourceMap` expects. */
function sourceMapFor (file: string): RawSourceMap | undefined {
  try {
    const cache = runner.moduleCache.get(file)
    cache.map ??= (cache.code && parseInlineSourceMap(cache.code)) as NonNullable<typeof cache.map> | undefined
    return cache.map as RawSourceMap | undefined
  } catch {
    return undefined
  }
}

const traced = new WeakMap<object, TraceMap>()

/** Position in the transformed code a source position was mapped from, 1-based as in a stack. */
export function getCompiledPosition (file: string, line: number, column?: number): { file: string, line: number, column: number } | undefined {
  const map = sourceMapFor(file)
  if (!map) {
    return undefined
  }
  let trace = traced.get(map)
  if (!trace) {
    trace = new TraceMap(encoded(map)!, file)
    traced.set(map, trace)
  }
  const source = trace.resolvedSources.find(candidate => candidate?.replaceAll('\\', '/') === file.replaceAll('\\', '/'))
  if (!source) {
    return undefined
  }
  const target = { source, line, column: column === undefined ? 0 : column - 1 }
  const position = generatedPositionFor(trace, { ...target, bias: column === undefined ? LEAST_UPPER_BOUND : GREATEST_LOWER_BOUND })
  const resolved = position.line === null ? generatedPositionFor(trace, { ...target, column: 0, bias: LEAST_UPPER_BOUND }) : position
  return resolved.line === null ? undefined : { file, line: resolved.line, column: resolved.column + 1 }
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
  id?: string
  message?: string
  stack?: string
  frame?: string
  loc?: ViteNodeErrorLocation
  plugin?: string
  pluginCode?: string
}

/** Error thrown when Vite fails to transform an SSR module. */
export interface ViteNodeError extends Error {
  code?: string
  /** Code frame, duplicated on `hint` for renderers that read it. */
  frame?: string
  hint?: string
  id?: string
  loc?: ViteNodeErrorLocation
  plugin?: string
  pluginCode?: string
}

export function buildViteError (errorData: ViteNodeErrorData, id: string): ViteNodeError {
  const file = (errorData.loc?.file || errorData.id || id || '').replace(process.cwd(), '.')
  const position = errorData.loc?.line === undefined ? '' : `:${errorData.loc.line}${errorData.loc.column === undefined ? '' : `:${errorData.loc.column}`}`
  const loc = file + position

  // `err.message` from some compilers (notably @vue/compiler-sfc) embeds a
  // `[scope/plugin]` prefix plus a code frame, separated from the real
  // description by a blank line. Split on that boundary so we can show the
  // clean one-liner as the heading and feed the frame text to `hint` below.
  const rawMessage: string = errorData.message || ''
  const [headRaw, ...frameTail] = rawMessage.split(/\r?\n\s*\n/)
  const reason = ((headRaw || '').split(/\r?\n/)[0] ?? '')
    .replace(/^\[@?[\w.\-/:]+\]\s*/, '')
    .trim()
  const messageFrame = frameTail.length ? frameTail.join('\n\n').trim() : ''

  const message = reason ? `${loc} — ${reason}` : (rawMessage || loc)

  const error = Object.assign(new Error(message), {
    name: 'ViteError',
    statusText: 'Vite Error',
    statusMessage: 'Vite Error',
    code: errorData.code,
    // Youch renders `hint` as a styled callout alongside the main message —
    // a natural home for the code frame.
    hint: errorData.frame || messageFrame || undefined,
    // Vite's own error payload, which an error handler reads for an exact location
    frame: errorData.frame || messageFrame || undefined,
    id: errorData.id || id,
    ...errorData.loc && { loc: errorData.loc },
    ...errorData.plugin && { plugin: errorData.plugin },
    ...errorData.pluginCode && { pluginCode: errorData.pluginCode },
  }) satisfies ViteNodeError

  // Prefer the server-side stack so Youch's stack viewer points at the real
  // origin (compiler-sfc → plugin-vue → Vite) rather than this runner.
  if (errorData.stack) {
    error.stack = errorData.stack
  }

  return error
}

export default runner
