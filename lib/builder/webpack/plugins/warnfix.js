module.exports = class WarnFixPlugin {
  apply(compiler) /* istanbul ignore next */ {
    compiler.plugin('done', stats => {
      stats.compilation.warnings = stats.compilation.warnings.filter(warn => {
        if (
          warn.name === 'ModuleDependencyWarning' &&
          warn.message.includes(`export 'default'`) &&
          warn.message.includes('nuxt_plugin_')
        ) {
          return false
        }
        return true
      })
    })
  }
}
