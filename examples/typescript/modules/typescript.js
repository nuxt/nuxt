module.exports = function (options) {
  // Extend build
  this.extendBuild((config) => {
    // Add TypeScript loader
    config.module.rules.push({
      test: /\.ts$/,
      loader: 'ts-loader'
    })
    // Add TypeScript loader for vue files
    for (let rule of config.module.rules) {
      if (rule.loader === 'vue-loader') {
        rule.query.loaders.ts = 'ts-loader?{"appendTsSuffixTo":["\\\\.vue$"]}'
      }
    }
  })
}
