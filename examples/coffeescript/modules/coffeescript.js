export default function () {
  // Add .coffee extension for store, middleware and more
  this.nuxt.options.extensions.push('coffee')
  // Extend build
  const coffeeLoader = {
    test: /\.coffee$/,
    loader: 'coffee-loader'
  }
  this.extendBuild((config) => {
    // Add CoffeeScruot loader
    config.module.rules.push(coffeeLoader)
    // Add .coffee extension in webpack resolve
    if (config.resolve.extensions.indexOf('.coffee') === -1) {
      config.resolve.extensions.push('.coffee')
    }
  })
}
