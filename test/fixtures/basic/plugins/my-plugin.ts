export default defineNuxtPlugin(() => {
  useHead({
    titleTemplate: '%s - Fixture'
  })
  const path = useRoute().path
  return {
    provide: {
      myPlugin: () => 'Injected by my-plugin',
      path: () => path
    }
  }
})
