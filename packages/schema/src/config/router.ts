import { booleanOr, defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'auto',
      sensitive: booleanOr(true),
    },
  },
})
