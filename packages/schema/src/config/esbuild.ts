import { defu } from 'defu'
import type { TransformOptions } from 'esbuild'
import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  esbuild: {
    /**
     * Configure shared esbuild options used within Nuxt and passed to other builders, such as Vite or Webpack.
     * @type {import('esbuild').TransformOptions}
     */
    options: {
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      tsconfigRaw: {
        $resolve: async (_val, get) => {
          const val: NonNullable<Exclude<TransformOptions['tsconfigRaw'], string>> = typeof _val === 'string' ? JSON.parse(_val) : (_val && typeof _val === 'object' ? _val : {})

          const useDecorators = await get('experimental').then(r => (r as Record<string, unknown>)?.decorators === true)
          if (!useDecorators) {
            return val
          }
          return defu(val, {
            compilerOptions: {
              useDefineForClassFields: false,
              experimentalDecorators: false,
            },
          } satisfies TransformOptions['tsconfigRaw'])
        },
      },
    },
  },
})
