import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  oxc: {
    transform: {
      options: {
        target: {
          $resolve: async (val) => {
            if (typeof val === 'string') {
              return val
            }
            return 'esnext'
          },
        },
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
      },
    },
  },
})
