let counter = 0

const test = () => () => {
  // TODO: useNuxtApp should be undefined when type-testing a nitro route
  useNuxtApp()
}
test()

export default defineEventHandler(() => ({ count: counter++ }))
