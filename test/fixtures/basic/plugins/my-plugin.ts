export default defineNuxtPlugin(() => {
  useHead({
    titleTemplate: '%s - Fixture',
    style: [{
      innerHTML: () => 'body { color: red }',
      tagPriority: -2,
      id: 'plugin-style',
    }],
  })
  const path = useRoute()?.path
  return {
    provide: {
      myPlugin: () => 'Injected by my-plugin',
      path: () => path,
    },
  }
})
