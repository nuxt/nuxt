import type { Stats } from 'webpack'

/**
 * Format the errors of a compilation by module name and import trace, leaving out the loader
 * chain that makes up each module's identifier.
 */
export function formatCompilationErrors (stats: Pick<Stats, 'toJson'>): string {
  const { errors = [] } = stats.toJson({ all: false, errors: true, moduleTrace: true })
  return errors.map((error) => {
    const location = error.moduleName ? `ERROR in ${withoutLoaders(error.moduleName)}${error.loc ? ` ${error.loc}` : ''}` : 'ERROR'
    const trace = (error.moduleTrace ?? [])
      .flatMap(entry => entry.originName ? [` @ ${withoutLoaders(entry.originName)}`] : [])
      .filter((line, index, lines) => line !== lines[index - 1])
    return [location, error.message, ...trace].join('\n')
  }).join('\n\n')
}

function withoutLoaders (name: string): string {
  return name.slice(name.lastIndexOf('!') + 1)
}
