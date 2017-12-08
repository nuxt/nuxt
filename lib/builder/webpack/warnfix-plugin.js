export default class WarnFixPlugin {
  apply(compiler) {
    compiler.plugin('done', stats => {
      stats.compilation.warnings = stats.compilation.warnings.filter(warn => {
        /* istanbul ignore next */
        if (warn.name === 'ModuleDependencyWarning' &&
          warn.message.includes(`export 'default'`) &&
          warn.message.indexOf('nuxt_plugin_') === 0) {
          return false
        }
        return true
      })
    })
  }
}
