import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'auto',
    },
  },
})
