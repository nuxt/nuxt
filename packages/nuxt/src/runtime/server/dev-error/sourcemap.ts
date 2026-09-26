/**
 * Sourcemap lookups shared by the server builders that evaluate the SSR bundle in-process.
 *
 * @module nuxt/internal/dev-error/sourcemap
 */
import { GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND, TraceMap, generatedPositionFor, originalPositionFor } from '@jridgewell/trace-mapping'
import type { SourceMapInput } from '@jridgewell/trace-mapping'

export type { TraceMap } from '@jridgewell/trace-mapping'

/** A position in a file, 1-based in both line and column as in a stack frame. */
export interface SourcePosition {
  file: string
  line: number
  column: number
}

/** A path led by a drive letter, which resolves as relative unless it is made root-absolute. */
const DRIVE_LETTER_RE = /^[a-z]:\//i

/**
 * `path` in the root-absolute form sources are resolved against. A windows path is a
 * relative URI, so resolving `D:/repo/boom.ts` against `D:/repo/boom.ts` would otherwise
 * yield `D:/repo/D:/repo/boom.ts`.
 */
function toAbsolute (path: string): string {
  const slashed = path.replaceAll('\\', '/')
  return DRIVE_LETTER_RE.test(slashed) ? `/${slashed}` : slashed
}

/** The inverse of {@link toAbsolute}, so a mapped frame names the path the platform uses. */
function fromAbsolute (path: string): string {
  return path.startsWith('/') && DRIVE_LETTER_RE.test(path.slice(1)) ? path.slice(1) : path
}

const traced = new WeakMap<object, TraceMap>()

/**
 * The map of `id`, traced once and kept for as long as its owner holds the raw map.
 * `version` and `names` are filled in for producers that leave them off.
 */
export function traceMapFor (map: object, id: string): TraceMap {
  let trace = traced.get(map)
  if (!trace) {
    const { sources } = map as { sources?: (string | null)[] }
    const input = {
      version: 3,
      names: [],
      ...map,
      ...sources && { sources: sources.map(source => source && toAbsolute(source)) },
    }
    trace = new TraceMap(input as unknown as SourceMapInput, toAbsolute(id))
    traced.set(map, trace)
  }
  return trace
}

/** Name of `file` among the map's sources, which are resolved against the module id. */
export function resolveSource (trace: TraceMap, file: string): string | undefined {
  const target = toAbsolute(file)
  return trace.resolvedSources.find(source => source && toAbsolute(source) === target) ?? undefined
}

/** Source position a position in the generated code came from. */
export function originalPosition (trace: TraceMap, line: number, column: number): SourcePosition | undefined {
  const position = originalPositionFor(trace, { line, column: column - 1 })
  if (position.source === null || position.line === null) {
    return undefined
  }
  return { file: fromAbsolute(position.source), line: position.line, column: (position.column ?? 0) + 1 }
}

/**
 * Position in the generated code a source position was mapped from. The innermost mapping
 * at or before the column wins; without a column, the first mapping on the line does.
 */
export function generatedPosition (trace: TraceMap, source: string, line: number, column?: number): { line: number, column: number } | undefined {
  const target = { source, line, column: column === undefined ? 0 : column - 1 }
  const position = generatedPositionFor(trace, { ...target, bias: column === undefined ? LEAST_UPPER_BOUND : GREATEST_LOWER_BOUND })
  const resolved = position.line === null ? generatedPositionFor(trace, { ...target, column: 0, bias: LEAST_UPPER_BOUND }) : position
  return resolved.line === null ? undefined : { line: resolved.line, column: resolved.column + 1 }
}
