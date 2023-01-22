import { resolve } from 'pathe'
import { withoutLeadingSlash } from 'ufo'
import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  /**
   * Configuration that will be passed directly to Vite.
   *
   * See https://vitejs.dev/config for more information.
   * Please note that not all vite options are supported in Nuxt.
   *
   * @type {typeof import('../src/types/config').ViteConfig}
   */
  vite: {
    root: {
      $resolve: async (val, get) => val ?? (await get('srcDir'))
    },
    mode: {
      $resolve: async (val, get) => val ?? (await get('dev') ? 'development' : 'production')
    },
    logLevel:{
      $resolve: async (val, get) => val ?? (await get('dev') ? 'warn' : 'info')
    },
    define: {
      $resolve: async (val, get) => ({
        'process.dev': await get('dev'),
        ...val || {}
      })
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    publicDir: {
      $resolve: async (val, get) => val ?? resolve((await get('srcDir')), (await get('dir')).public)
    },
    vue: {
      isProduction: {
        $resolve: async (val, get) => val ?? !(await get('dev'))
      },
      template: {
        compilerOptions: {
          $resolve: async (val, get) => val ?? (await get('vue')).compilerOptions
        }
      }
    },
    optimizeDeps: {
      exclude: {
        $resolve: async (val, get) => [
          ...val || [],
          ...(await get('build.transpile')).filter((i: string) => typeof i === 'string'),
          'vue-demi'
        ]
      }
    },
    esbuild: {
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      tsconfigRaw: '{}'
    },
    clearScreen: false,
    build: {
      assetsDir: {
        $resolve: async (val, get) => val ?? withoutLeadingSlash((await get('app')).buildAssetsDir)
      },
      emptyOutDir: false
    },
    server: {
      fs: {
        allow: {
          $resolve: async (val, get) => [
            await get('buildDir'),
            await get('srcDir'),
            await get('rootDir'),
            await get('workspaceDir'),
            ...(await get('modulesDir')),
            ...val ?? []
          ]
        }
      }
    }
  }
})
