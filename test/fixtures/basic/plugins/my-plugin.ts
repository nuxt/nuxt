export default defineNuxtPlugin(() => {
  return {
    provide: {
      myPlugin: () => 'Injected by my-plugin'
    }
  }
})
