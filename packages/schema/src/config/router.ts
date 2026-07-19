import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'auto',
      sensitive: {
        $resolve: async (val, get) => {
          return typeof val === 'boolean' ? val : (await get('future.compatibilityVersion')) >= 5
        },
      },
    },
  },
})
