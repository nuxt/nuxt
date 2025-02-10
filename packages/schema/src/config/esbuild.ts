import { defu } from 'defu'
import { defineUntypedSchema } from 'untyped'
import type { TransformOptions } from 'esbuild'

export default defineUntypedSchema({
  esbuild: {
    /**
     * Configure shared esbuild options used within Nuxt and passed to other builders, such as Vite or Webpack.
     */
    options: {
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      tsconfigRaw: {
        $resolve: async (val: TransformOptions['tsconfigRaw'], get) => {
          return defu(val, {
            compilerOptions: {
              experimentalDecorators: await get('experimental').then(r => (r as Record<string, unknown>)?.decorators as boolean),
            },
          } satisfies TransformOptions['tsconfigRaw'])
        },
      },
    },
  },
})
