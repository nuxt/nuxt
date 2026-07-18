import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'auto',
      sensitive: {
        $resolve: async (val, get) => {
          // vue-router is case-insensitive by default, which is at variance with nitro.
          // Default to case-sensitive routing to avoid a class of bugs (breaking change in v5).
          return typeof val === 'boolean' ? val : (await get('future.compatibilityVersion')) >= 5
        },
      },
    },
  },
})
