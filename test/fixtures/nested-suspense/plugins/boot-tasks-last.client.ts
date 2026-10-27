export default defineNuxtPlugin({
  order: 1000,
  setup (nuxtApp) {
    let crossedTask = false
    scheduler.postTask(() => { crossedTask = true }, { priority: 'user-blocking' })
    nuxtApp.hook('app:beforeMount', () => {
      window.__bootTasks!.beforeMountAfterPluginTask = crossedTask
    })
  },
})
