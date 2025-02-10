import { defu } from 'defu'
import { defineUntypedSchema } from 'untyped'
import type { TransformOptions } from 'esbuild'

export default defineUntypedSchema({
  esbuild: {
    /**
     * Configure shared esbuild options used within Nuxt and passed to other builders, such as Vite or Webpack.
     * @type {import('esbuild').TransformOptions}
     */
    options: {
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      tsconfigRaw: {
        $resolve: async (val: TransformOptions['tsconfigRaw'], get) => {
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
