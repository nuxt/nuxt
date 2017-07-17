module.exports = function () {
  let ctr = 1

  // Add hook for module
  this.nuxt.plugin('module', moduleContainer => {
    this.nuxt.__module_hook = moduleContainer && ctr++
  })

  // Add hook for renderer
  this.nuxt.plugin('renderer', renderer => {
    this.nuxt.__renderer_hook = renderer && ctr++
  })

  // Add hook for build
  this.nuxt.plugin('build', builder => {
    this.nuxt.__builder_hook = builder && ctr++
  })
}
