import { definePlugin } from 'nitro'
import { generatedPosition, resolveSource, traceMapFor } from 'nuxt/internal/dev-error/sourcemap'
import type { EvaluatedModules } from 'vite/module-runner'

interface ViteEnvRunner {
  runner?: { evaluatedModules?: EvaluatedModules, evaluator?: { startOffset?: number } }
}

interface RunnerModules {
  modules: EvaluatedModules
  /** Lines the evaluator prepends to a module, shifting its generated positions. */
  startOffset: number
}

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

/** Module ids to search, the file's own module first; the rest catch inlined sources. */
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

function getCompiledPosition (file: string, line: number, column?: number): { file: string, line: number, column: number } | undefined {
  for (const { modules, startOffset } of getRunnerModules()) {
    for (const id of candidateIds(modules, file)) {
      const map = modules.getModuleSourceMapById(id)?.map
      if (!map?.mappings) {
        continue
      }
      const trace = traceMapFor(map, id)
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
  nitroApp.ssrSourceMaps = { getCode, getCompiledPosition }
})
