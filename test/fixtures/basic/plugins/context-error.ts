export default defineNuxtPlugin(() => {
  // this should be undefined
  const vueApp = getCurrentInstance()
  return {
    provide: {
      wasVueAppInstanceWronglyPreserved: !!vueApp
    }
  }
})
