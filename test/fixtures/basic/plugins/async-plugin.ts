export default defineNuxtPlugin(async (/* nuxtApp */) => {
  const config1 = useRuntimeConfig()
  await new Promise(resolve => setTimeout(resolve, 100))
  const { data } = useFetch('/api/hey', { key: 'hey' })
  const config2 = useRuntimeConfig()
  return {
    provide: {
      asyncPlugin: () => config1 && config1 === config2
        ? 'Async plugin works! ' + config1.testConfig + (data.value?.baz ? 'useFetch works!' : 'useFetch does not work')
        : 'Async plugin failed!'
    }
  }
})
