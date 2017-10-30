module.exports = function () {
  let ctr = 1

  // Add hook for module
  this.nuxt.hook('modules:done', (moduleContainer) => {
    this.nuxt.__module_hook = moduleContainer && ctr++
  })

  // Add hook for renderer
  this.nuxt.hook('render:done', (renderer) => {
    this.nuxt.__renderer_hook = renderer && ctr++
  })

  // Add hook for build
  this.nuxt.hook('build:done', (builder) => {
    this.nuxt.__builder_hook = builder && ctr++
  })
}
