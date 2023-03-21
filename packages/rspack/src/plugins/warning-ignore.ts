import type { Compiler, WebpackError } from '@rspack/core'

export type WarningFilter = (warn: WebpackError) => boolean

export default class WarningIgnorePlugin {
  filter: WarningFilter

  constructor (filter: WarningFilter) {
    this.filter = filter
  }

  apply (compiler: Compiler) {
    compiler.hooks.done.tap('warnfix-plugin', (stats) => {
      stats.compilation.warnings = stats.compilation.warnings.filter(this.filter)
    })
  }
}
