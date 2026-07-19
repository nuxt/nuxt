import { existsSync } from 'node:fs'
import { relative, resolve } from 'pathe'
import { defineResolvers } from '../utils/definition.ts'
import { schemaDiagnostics } from '../diagnostics.ts'

export default defineResolvers({
  vite: {
    root: {
      $resolve: (val, get) => typeof val === 'string' ? val : (get('srcDir')),
    },
    mode: {
      $resolve: async (val, get) => typeof val === 'string' ? val : (await get('dev') ? 'development' : 'production'),
    },
    define: {
      $resolve: async (_val, get) => {
        const [isDev, isTest, isDebug] = await Promise.all([get('dev'), get('test'), get('debug')])
        return {
          '__VUE_PROD_DEVTOOLS__': false,
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
      $resolve: (val) => {
        if (val) {
          schemaDiagnostics.NUXT_B5014()
        }
        // this is missing from our `vite` types deliberately, so users do not configure it
        return false as never
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
        const options: { defineComponentName?: string[] } = val && typeof val === 'object' ? val : {}
        return {
          // TODO: investigate type divergence between types for @vue/compiler-core and @vue/babel-plugin-jsx
          isCustomElement: (await get('vue')).compilerOptions?.isCustomElement as undefined | ((tag: string) => boolean),
          defineComponentName: [...new Set([...options.defineComponentName ?? ['defineComponent'], 'defineNuxtComponent'])],
          ...options,
        }
      },
    },
    optimizeDeps: {
      exclude: {
        $resolve: val => [
          ...Array.isArray(val) ? val : [],
          'vue-demi',
        ],
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
      $resolve: async (val, get) => {
        if (typeof val === 'string') {
          return val
        }

        const rootDir = await get('rootDir')
        if (existsSync(resolve(rootDir, 'node_modules'))) {
          return resolve(rootDir, 'node_modules/.cache/vite')
        }

        const workspaceDir = await get('workspaceDir')
        const relativeRoot = relative(workspaceDir, rootDir)
        if (!relativeRoot || relativeRoot.startsWith('..')) {
          return resolve(rootDir, 'node_modules/.cache/vite')
        }

        return resolve(workspaceDir, 'node_modules/.cache/vite', relativeRoot)
      },
    },
  },
})
