let crossedTask = false
scheduler.postTask(() => { crossedTask = true }, { priority: 'user-blocking' })

export default defineNuxtPlugin({
  order: -1000,
  setup () {
    window.__bootTasks = { createdAfterModuleTask: crossedTask }
  },
})

declare global {
  interface Window {
    __bootTasks?: Record<string, boolean>
  }
}
