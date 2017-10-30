module.exports = function () {
  let ctr = 1

  // Add hook for module
  this.plugin('modules:done', (moduleContainer) => {
    this.nuxt.__module_hook = moduleContainer && ctr++
  })

  // Add hook for renderer
  this.nuxt.hook('render:done', (renderer) => {
    this.nuxt.__renderer_hook = renderer && ctr++
  })

  // Add hook for build
  this.nuxt.plugin('build:done', (builder) => {
    this.nuxt.__builder_hook = builder && ctr++
  })
}
