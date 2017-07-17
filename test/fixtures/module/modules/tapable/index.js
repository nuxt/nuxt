module.exports = function () {
  let ctr = 1

  // Add hook for module
  this.nuxt.plugin('module', async moduleContainer => {
    this.nuxt.__module_hook = moduleContainer && ctr++
  })

  // Add hook for renderer
  this.nuxt.plugin('renderer', async renderer => {
    this.nuxt.__renderer_hook = renderer && ctr++
  })

  // Add hook for build
  this.nuxt.plugin('build', async builder => {
    this.nuxt.__builder_hook = builder && ctr++
  })
}
