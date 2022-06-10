export default defineNuxtPlugin(() => {
  return {
    provide: {
      foo: () => 'String generated from foo plugin!'
    }
  }
})
