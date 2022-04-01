export default defineNuxtPlugin(async (/* nuxtApp */) => {
  const config1 = useRuntimeConfig()
  await new Promise(resolve => setTimeout(resolve, 100))
  const config2 = useRuntimeConfig()
  return {
    provide: {
      asyncPlugin: () => config1 && config1 === config2
        ? 'Async plugin works! ' + config1.testConfig
        : 'Async plugin failed!'
    }
  }
})
