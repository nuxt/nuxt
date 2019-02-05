export default class WarnFixPlugin {
  constructor(filter) {
    this.filter = filter
  }

  apply(compiler) /* istanbul ignore next */ {
    compiler.hooks.done.tap('warnfix-plugin', (stats) => {
      stats.compilation.warnings = stats.compilation.warnings.filter(this.filter)
    })
  }
}
