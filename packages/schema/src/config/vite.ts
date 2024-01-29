import { consola } from 'consola'
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
      $resolve: async (val, get) => {
        const [isDev, isDebug] = await Promise.all([get('dev'), get('debug')])
        return {
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: isDebug,
          'process.dev': isDev,
          'import.meta.dev': isDev,
          'process.test': isTest,
          'import.meta.test': isTest,
          ...val
        }
      }
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    publicDir: {
      $resolve: async (val, get) => {
        if (val) {
          consola.warn('Directly configuring the `vite.publicDir` option is not supported. Instead, set `dir.public`. You can read more in `https://nuxt.com/docs/api/nuxt-config#public`.')
        }
        return val ?? await Promise.all([get('srcDir'), get('dir')]).then(([srcDir, dir]) => resolve(srcDir, dir.public))
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
          $resolve: async (val, get) => val ?? Boolean((await get('vue')).propsDestructure)
        }
      }
    },
    vueJsx: {
      $resolve: async (val, get) => {
        return {
          isCustomElement: (await get('vue')).compilerOptions?.isCustomElement,
          ...val
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
          $resolve: async (val, get) => {
            const [buildDir, srcDir, rootDir, workspaceDir, modulesDir] = await Promise.all([get('buildDir'), get('srcDir'), get('rootDir'), get('workspaceDir'), get('modulesDir')])
            return [
              buildDir,
              srcDir,
              rootDir,
              workspaceDir,
              ...(modulesDir),
              ...val ?? []
            ]
          }
        }
      }
    }
  }
})
