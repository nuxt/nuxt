import { ViteNodeRunner } from 'vite-node/client'

import { consola } from 'consola'
import { parseInlineSourceMap } from 'my-bad'
import type { RawSourceMap } from 'my-bad'
import { viteNodeFetch, viteNodeOptions } from '#vite-node'
import process from 'node:process'

const runner: ViteNodeRunner = createRunner()

const FRAME_POSITION_RE = /\((.*):(\d+):(\d+)\)$/gm

/**
 * Sourcemap for an SSR-transformed file, if one is known.
 *
 * @param file - Absolute path of the module as it appears in a stack frame.
 */
export function getSourceMap (file: string): RawSourceMap | undefined {
  try {
    const cache = runner.moduleCache.get(file)
    if (!cache.map) {
      const map = cache.code && parseInlineSourceMap(cache.code)
      if (!map) {
        return undefined
      }
      cache.map = map as NonNullable<typeof cache.map>
    }
    return cache.map as RawSourceMap
  } catch {
    return undefined
  }
}

/**
 * SSR-transformed code of a module as it was evaluated, including any inline
 * sourcemap comment, if the runner still holds it.
 *
 * @param file - Absolute path of the module as it appears in a stack frame.
 */
export function getCode (file: string): string | undefined {
  try {
    return runner.moduleCache.get(file).code
  } catch {
    return undefined
  }
}

/**
 * Rewrite the positions in a stack string from SSR-transformed positions to
 * source positions, without mutating any error object.
 *
 * The mapping is applied to a throwaway carrier, so that an asynchronous
 * `ssrFixStacktrace` cannot rewrite a stack the caller has already read.
 * Columns are emitted 1-based, as in a V8 stack, rather than the 0-based
 * columns a sourcemap stores.
 *
 * @param stack - The `error.stack` string to map.
 * @returns The mapped stack, or the input unchanged if no mapping applies.
 */
export function fixStacktrace (stack: string): string {
  if (!stack) {
    return stack
  }
  // `ssrFixStacktrace` only consults maps already cached on `moduleCache`
  for (const match of stack.matchAll(FRAME_POSITION_RE)) {
    getSourceMap(match[1]!)
  }
  const carrier = { name: 'Error', message: '', stack } as Error
  try {
    runner.ssrFixStacktrace(carrier)?.catch?.(() => {})
  } catch {
    return stack
  }
  const mapped = typeof carrier.stack === 'string' ? carrier.stack : stack
  if (mapped === stack) {
    return stack
  }
  const originalLines = stack.split('\n')
  return mapped.split('\n').map((line, index) => {
    if (line === originalLines[index]) {
      return line
    }
    return line.replace(FRAME_POSITION_RE, (_, file: string, line: string, column: string) => `(${file}:${line}:${Number(column) + 1})`)
  }).join('\n')
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
  /** Module id Vite was transforming. */
  id?: string
  /** Exact position of the failure, when the failing plugin reported one. */
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
    // Vite's own error payload, so error handlers can render an exact location.
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
