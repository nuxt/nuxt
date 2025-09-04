import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'auto',
    },
  },
})
