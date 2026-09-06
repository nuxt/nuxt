import { definePlugin } from 'nitro'
import { GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND, TraceMap, generatedPositionFor } from '@jridgewell/trace-mapping'
import type { SourceMapInput } from '@jridgewell/trace-mapping'
import type { EvaluatedModules } from 'vite/module-runner'

interface ViteEnvRunner {
  runner?: { evaluatedModules?: EvaluatedModules, evaluator?: { startOffset?: number } }
}

interface RunnerModules {
  modules: EvaluatedModules
  /**
   * Lines the evaluator prepends to a module before running it, which shift its
   * generated positions ahead of the code the module was served as.
   */
  startOffset: number
}

/** The Vite `ModuleRunner`s Nitro registers in the worker that evaluates the app. */
function getRunnerModules (): RunnerModules[] {
  const envs = (globalThis as { __nitro_vite_envs__?: Record<string, ViteEnvRunner | undefined> }).__nitro_vite_envs__
  const runners: RunnerModules[] = []
  for (const env of Object.values(envs || {})) {
    if (env?.runner?.evaluatedModules) {
      runners.push({ modules: env.runner.evaluatedModules, startOffset: env.runner.evaluator?.startOffset ?? 0 })
    }
  }
  return runners
}

function getEvaluatedModules (): EvaluatedModules[] {
  return getRunnerModules().map(runner => runner.modules)
}

function getCode (file: string): string | undefined {
  for (const modules of getEvaluatedModules()) {
    const id = modules.getModuleById(file)?.id ?? modules.getModulesByFile(file)?.values().next().value?.id
    if (!id) {
      continue
    }
    const meta = modules.getModuleById(id)?.meta
    if (meta && 'code' in meta && typeof meta.code === 'string') {
      return meta.code
    }
  }
  return undefined
}

/**
 * Module ids to search for a source position, the module of the file itself
 * first; only inlined or virtual modules need the rest of the graph.
 */
function* candidateIds (modules: EvaluatedModules, file: string): Generator<string> {
  const own = modules.getModuleById(file)?.id ?? modules.getModulesByFile(file)?.values().next().value?.id
  if (own) {
    yield own
  }
  for (const id of modules.idToModuleMap.keys()) {
    if (id !== own) {
      yield id
    }
  }
}

const traced = new WeakMap<object, TraceMap>()

/** The map of `id`, traced once and kept for as long as the runner holds it. */
function traceMap (map: object, id: string): TraceMap {
  let trace = traced.get(map)
  if (!trace) {
    trace = new TraceMap(map as SourceMapInput, id)
    traced.set(map, trace)
  }
  return trace
}

/** Name of `file` among the map's sources, which are resolved against the module id. */
function resolveSource (trace: TraceMap, file: string): string | undefined {
  const target = file.replaceAll('\\', '/')
  return trace.resolvedSources.find(source => source?.replaceAll('\\', '/') === target) ?? undefined
}

/**
 * Position in `trace`'s generated code that a source position was mapped from,
 * with a 1-based column as in a stack frame.
 *
 * The innermost mapping at or before the column wins; a line with no such
 * mapping falls back to its first one.
 */
function generatedPosition (trace: TraceMap, source: string, line: number, column?: number): { line: number, column: number } | undefined {
  const target = { source, line, column: column === undefined ? 0 : column - 1 }
  const position = generatedPositionFor(trace, { ...target, bias: column === undefined ? LEAST_UPPER_BOUND : GREATEST_LOWER_BOUND })
  const resolved = position.line === null ? generatedPositionFor(trace, { ...target, column: 0, bias: LEAST_UPPER_BOUND }) : position
  return resolved.line === null ? undefined : { line: resolved.line, column: resolved.column + 1 }
}

function getCompiledPosition (file: string, line: number, column?: number): { file: string, line: number, column: number } | undefined {
  for (const { modules, startOffset } of getRunnerModules()) {
    for (const id of candidateIds(modules, file)) {
      const map = modules.getModuleSourceMapById(id)?.map
      if (!map?.mappings) {
        continue
      }
      const trace = traceMap(map, id)
      const source = resolveSource(trace, file)
      const position = source ? generatedPosition(trace, source, line, column) : undefined
      // positions are reported against the code `getCode` returns
      if (position && position.line > startOffset) {
        return { file: id, ...position, line: position.line - startOffset }
      }
    }
  }
  return undefined
}

export default definePlugin((nitroApp) => {
  nitroApp.ssrSourceMaps = {
    getCode,
    getCompiledPosition,
    // the `ModuleRunner` installs a sourcemap interceptor
    stacksAreMapped: true,
  }
})
