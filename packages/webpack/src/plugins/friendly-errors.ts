import type { Compiler, StatsCompilation, StatsError } from 'webpack'
import { logger } from '@nuxt/kit'

export class FriendlyErrorsPlugin {
  apply (compiler: Compiler) {
    compiler.hooks.done.tap('nuxt:friendly-errors', (stats) => {
      if (!stats.hasErrors()) {
        return
      }

      const errors = collectErrors(stats.toJson({ all: false, errors: true, children: true }))

      // eslint-disable-next-line no-restricted-syntax -- raw compiler output
      logger.error(`Failed to compile with ${errors.length} errors`)
      for (const error of errors) {
        const file = error.moduleName?.split('!').pop()
        if (file) {
          // eslint-disable-next-line no-restricted-syntax -- raw compiler output
          logger.error(`in ${file}`)
        }
        logger.log(error.message)
        logger.log('')
      }
    })
  }
}

function collectErrors (stats: StatsCompilation, seen = new Set<string>()): StatsError[] {
  const errors: StatsError[] = []
  for (const child of stats.children ?? []) {
    errors.push(...collectErrors(child, seen))
  }
  for (const error of stats.errors ?? []) {
    if (!seen.has(error.message)) {
      seen.add(error.message)
      errors.push(error)
    }
  }
  return errors
}
