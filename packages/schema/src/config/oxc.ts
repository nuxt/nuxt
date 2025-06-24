import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  oxc: {
    transform: {
      options: {
        target: {
          $resolve: async (val, get) => {
            if (typeof val === 'string') {
              return val
            }
            // https://github.com/vitejs/vite-plugin-vue/issues/528
            const useDecorators = await get('experimental').then(
              r => r?.decorators === true,
            )
            if (useDecorators) {
              return 'es2024'
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
