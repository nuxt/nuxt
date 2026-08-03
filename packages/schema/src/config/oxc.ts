import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  oxc: {
    transform: {
      options: {
        target: 'esnext',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
      },
    },
  },
})
