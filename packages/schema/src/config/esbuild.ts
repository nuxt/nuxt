import { defu } from 'defu'
import type { TransformOptions } from 'esbuild'
import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  esbuild: {
    options: {
      target: {
        $resolve: async (val, get) => {
          if (typeof val === 'string') {
            return val
          }
          // https://github.com/vitejs/vite-plugin-vue/issues/528
          const useDecorators = await get('experimental').then(r => r?.decorators === true)
          if (useDecorators) {
            return 'es2024'
          }
          return 'esnext'
        },
      },
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      tsconfigRaw: {
        $resolve: async (_val, get) => {
          const val: NonNullable<Exclude<TransformOptions['tsconfigRaw'], string>> = typeof _val === 'string' ? JSON.parse(_val) : (_val && typeof _val === 'object' ? _val : {})

          const useDecorators = await get('experimental').then(r => r?.decorators === true)
          if (!useDecorators) {
            return val
          }
          // Force experimentalDecorators to false if decorators are enabled
          return defu({
            compilerOptions: {
              experimentalDecorators: false,
            },
          } satisfies TransformOptions['tsconfigRaw'], val)
        },
      },
    },
  },
})
