import { defineHandler } from 'nitro/h3'

let counter = 0

const test = () => () => {
  // TODO: useNuxtApp should be undefined when type-testing a nitro route
  useNuxtApp()
}
test()

export default defineHandler(() => ({ count: counter++ }))
