import type { Stats, StatsCompilation } from 'webpack'

/**
 * Format the errors of a compilation and its child compilations by module name and import trace,
 * leaving out the loader chain that makes up each module's identifier.
 */
export function formatCompilationErrors (stats: Pick<Stats, 'toJson'>): string {
  return collectErrors(stats.toJson({ all: false, errors: true, moduleTrace: true, children: true })).map((error) => {
    const trace = (error.moduleTrace ?? [])
      .flatMap(entry => entry.originName ? [` @ ${withoutLoaders(entry.originName)}`] : [])
      .filter((line, index, lines) => line !== lines[index - 1])
    return [formatLocation(error), error.message, ...trace].join('\n')
  }).join('\n\n')
}

type StatsError = NonNullable<StatsCompilation['errors']>[number]

function collectErrors (compilation: StatsCompilation): StatsError[] {
  return [...compilation.errors ?? [], ...(compilation.children ?? []).flatMap(collectErrors)]
}

function formatLocation (error: StatsError): string {
  if (error.moduleName) {
    return `ERROR in ${withoutLoaders(error.moduleName)}${error.loc ? ` ${error.loc}` : ''}`
  }
  return error.file ? `ERROR in ${error.file}` : 'ERROR'
}

function withoutLoaders (name: string): string {
  return name.slice(name.lastIndexOf('!') + 1)
}
