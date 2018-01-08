module.exports = function () {
  // Add .coffee extension for store, middleware and more
  this.nuxt.options.extensions.push('coffee')
  // Extend build
  const coffeeLoader = {
    test: /\.coffee$/,
    loader: 'coffee-loader'
  }
  this.extendBuild(config => {
    // Add CoffeeScruot loader
    config.module.rules.push(coffeeLoader)
    // Add CoffeeScript loader for vue files
    for (let rule of config.module.rules) {
      if (rule.loader === 'vue-loader') {
        rule.options.loaders.coffee = coffeeLoader
      }
    }
    // Add .coffee extension in webpack resolve
    if (config.resolve.extensions.indexOf('.coffee') === -1) {
      config.resolve.extensions.push('.coffee')
    }
  })
}
