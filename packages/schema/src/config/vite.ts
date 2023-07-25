import { resolve } from 'pathe'
import { isTest } from 'std-env'
import { withoutLeadingSlash } from 'ufo'
import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  /**
   * Configuration that will be passed directly to Vite.
   *
   * See https://vitejs.dev/config for more information.
   * Please note that not all vite options are supported in Nuxt.
   *
   * @type {typeof import('../src/types/config').ViteConfig & { $client?: typeof import('../src/types/config').ViteConfig, $server?: typeof import('../src/types/config').ViteConfig }}
   */
  vite: {
    root: {
      $resolve: async (val, get) => val ?? (await get('srcDir'))
    },
    mode: {
      $resolve: async (val, get) => val ?? (await get('dev') ? 'development' : 'production')
    },
    define: {
      $resolve: async (val, get) => ({
        'process.dev': await get('dev'),
        'process.test': isTest,
        ...val || {}
      })
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    publicDir: {
      $resolve: async (val, get) => {
        if (val) {
          console.warn('Directly configuring the `vite.publicDir` option is not supported. Instead, set `dir.public`. You can read more in `https://nuxt.com/docs/api/configuration/nuxt-config#public`.')
        }
        return val ?? resolve((await get('srcDir')), (await get('dir')).public)
      }
    },
    vue: {
      isProduction: {
        $resolve: async (val, get) => val ?? !(await get('dev'))
      },
      template: {
        compilerOptions: {
          $resolve: async (val, get) => val ?? (await get('vue')).compilerOptions
        }
      },
      script: {
        propsDestructure: {
          $resolve: async (val, get) => val ?? Boolean((await get('vue')).propsDestructure),
        },
        defineModel: {
          $resolve: async (val, get) => val ?? Boolean((await get('vue')).defineModel),
        },
      }
    },
    vueJsx: {
      $resolve: async (val, get) => {
        return {
          isCustomElement: (await get('vue')).compilerOptions?.isCustomElement,
          ...(val || {})
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
    clearScreen: true,
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
