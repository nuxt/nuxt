import { consola } from 'consola'
import defu from 'defu'
import { resolve } from 'pathe'
import { isTest } from 'std-env'
import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  /**
   * Configuration that will be passed directly to Vite.
   *
   * @see [Vite configuration docs](https://vite.dev/config) for more information.
   * Please note that not all vite options are supported in Nuxt.
   */
  vite: {
    root: {
      $resolve: async (val, get) => typeof val === 'string' ? val : (await get('srcDir')),
    },
    mode: {
      $resolve: async (val, get) => typeof val === 'string' ? val : (await get('dev') ? 'development' : 'production'),
    },
    define: {
      $resolve: async (_val, get) => {
        const [isDev, isDebug] = await Promise.all([get('dev'), get('debug')])
        return {
          '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': Boolean(isDebug && (isDebug === true || isDebug.hydration)),
          'process.dev': isDev,
          'import.meta.dev': isDev,
          'process.test': isTest,
          'import.meta.test': isTest,
          ..._val && typeof _val === 'object' ? _val : {},
        }
      },
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    },
    publicDir: {
      // @ts-expect-error this is missing from our `vite` types deliberately, so users do not configure it
      $resolve: (val) => {
        if (val) {
          consola.warn('Directly configuring the `vite.publicDir` option is not supported. Instead, set `dir.public`. You can read more in `https://nuxt.com/docs/api/nuxt-config#public`.')
        }
        return false
      },
    },
    vue: {
      isProduction: {
        $resolve: async (val, get) => typeof val === 'boolean' ? val : !(await get('dev')),
      },
      template: {
        compilerOptions: {
          $resolve: async (val, get) => val ?? (await get('vue')).compilerOptions,
        },
        transformAssetUrls: {
          $resolve: async (val, get) => val ?? (await get('vue')).transformAssetUrls,
        },
      },
      script: {
        hoistStatic: {
          $resolve: async (val, get) => typeof val === 'boolean' ? val : (await get('vue')).compilerOptions?.hoistStatic,
        },
      },
      features: {
        propsDestructure: {
          $resolve: async (val, get) => {
            if (typeof val === 'boolean') {
              return val
            }
            const vueOptions = await get('vue') || {}
            return Boolean(
              // @ts-expect-error TODO: remove in future: supporting a legacy schema
              vueOptions.script?.propsDestructure
              ?? vueOptions.propsDestructure,
            )
          },
        },
      },
    },
    vueJsx: {
      $resolve: async (val, get) => {
        return {
          // TODO: investigate type divergence between types for @vue/compiler-core and @vue/babel-plugin-jsx
          isCustomElement: (await get('vue')).compilerOptions?.isCustomElement as undefined | ((tag: string) => boolean),
          ...typeof val === 'object' ? val : {},
        }
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        $resolve: async (val, get) => defu(val && typeof val === 'object' ? val : {}, await get('esbuild.options')),
      },
      exclude: {
        $resolve: async (val, get) => [
          ...Array.isArray(val) ? val : [],
          ...(await get('build.transpile')).filter(i => typeof i === 'string'),
          'vue-demi',
        ],
      },
    },
    esbuild: {
      $resolve: async (val, get) => {
        return defu(val && typeof val === 'object' ? val : {}, await get('esbuild.options'))
      },
    },
    clearScreen: true,
    build: {
      assetsDir: {
        $resolve: async (val, get) => typeof val === 'string' ? val : (await get('app')).buildAssetsDir?.replace(/^\/+/, ''),
      },
      emptyOutDir: false,
    },
    server: {
      fs: {
        allow: {
          $resolve: async (val, get) => {
            const [buildDir, srcDir, rootDir, workspaceDir] = await Promise.all([get('buildDir'), get('srcDir'), get('rootDir'), get('workspaceDir')])
            return [...new Set([
              buildDir,
              srcDir,
              rootDir,
              workspaceDir,
              ...Array.isArray(val) ? val : [],
            ])]
          },
        },
      },
    },
    cacheDir: {
      $resolve: async (val, get) => typeof val === 'string' ? val : resolve(await get('rootDir'), 'node_modules/.cache/vite'),
    },
  },
})
