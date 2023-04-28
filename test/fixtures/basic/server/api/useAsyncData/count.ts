let counter = 0

const test = () => () => {
  // @ts-expect-error useNuxtApp should be undefined in a nitro route
  useNuxtApp()
}
test()

export default defineEventHandler(() => ({ count: counter++ }))
