import { resolve } from 'pathe'
import { withoutLeadingSlash } from 'ufo'

export default {
  /**
   * Configuration that will be passed directly to Vite.
   *
   * See https://vitejs.dev/config for more information.
   * Please note that not all vite options are supported in Nuxt.
   *
   * @type {typeof import('../src/types/config').ViteConfig}
   * @version 3
   */
  vite: {
    root: {
      $resolve: (val, get) => val ?? get('srcDir'),
    },
    mode: {
      $resolve: (val, get) => val ?? (get('dev') ? 'development' : 'production'),
    },
    logLevel: 'warn',
    define: {
      $resolve: (val, get) => ({
        'process.dev': get('dev'),
        ...val || {}
      })
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    },
    publicDir: {
      $resolve: (val, get) => val ?? resolve(get('srcDir'), get('dir').public),
    },
    vue: {
      isProduction: {
        $resolve: (val, get) => val ?? !get('dev'),
      },
      template: { compilerOptions: {
        $resolve: (val, get) => val ?? get('vue').compilerOptions }
      },
    },
    optimizeDeps: {
      exclude: {
        $resolve: (val, get) => [
          ...val || [],
        ...get('build.transpile').filter(i => typeof i === 'string'),
        'vue-demi'
      ],
      },
    },
    esbuild: {
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      tsconfigRaw: '{}'
    },
    clearScreen: false,
    build: {
      assetsDir: {
        $resolve: (val, get) => val ?? withoutLeadingSlash(get('app').buildAssetsDir),
      },
      emptyOutDir: false,
    },
    server: {
      fs: {
        strict: false,
        allow: {
          $resolve: (val, get) => [
            get('buildDir'),
            get('srcDir'),
            get('rootDir'),
            ...get('modulesDir'),
            ...val ?? []
          ]
        }
      }
    }
  }
}
