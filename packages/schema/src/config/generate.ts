import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  // @ts-expect-error TODO: remove in nuxt v5
  generate: {
    routes: [],
    exclude: [],
  },
})
