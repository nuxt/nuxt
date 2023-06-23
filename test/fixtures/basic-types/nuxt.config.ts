import { addTypeTemplate } from 'nuxt/kit'

export default defineNuxtConfig({
  experimental: {
    typedPages: true
  },
  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        moduleResolution: process.env.MODULE_RESOLUTION
      }
    }
  },
  buildDir: process.env.NITRO_BUILD_DIR,
  builder: process.env.TEST_BUILDER as 'webpack' | 'vite' ?? 'vite',
  theme: './extends/bar',
  extends: [
    './extends/node_modules/foo'
  ],
  runtimeConfig: {
    baseURL: '',
    baseAPIToken: '',
    privateConfig: 'secret_key',
    public: {
      ids: [1, 2, 3],
      needsFallback: undefined,
      testConfig: 123
    }
  },
  appConfig: {
    fromNuxtConfig: true,
    nested: {
      val: 1
    }
  },
  modules: [
    function (_, nuxt) {
      // TODO: remove in v3.7
      if (process.env.TS_BASE_URL === 'without-base-url') {
        nuxt.hook('prepare:types', ({ tsConfig }) => {
          delete tsConfig.compilerOptions!.baseUrl
        })
      }
    },
    function () {
      addTypeTemplate({
        filename: 'test.d.ts',
        getContents: () => 'declare type Fromage = "cheese"'
      })
    },
    './modules/test',
    [
      '~/modules/example',
      {
        typeTest (val) {
          // @ts-expect-error module type defines val as boolean
          const b: string = val
          return !!b
        }
      }
    ],
    function (_options, nuxt) {
      nuxt.hook('pages:extend', (pages) => {
        pages.push({
          name: 'internal-async-parent',
          path: '/internal-async-parent'
        })
      })
    }
  ],
  telemetry: false, // for testing telemetry types - it is auto-disabled in tests
  hooks: {
    'schema:extend' (schemas) {
      schemas.push({
        appConfig: {
          someThing: {
            value: {
              $default: 'default',
              $schema: {
                tsType: 'string | false'
              }
            }
          }
        }
      })
    },
    'prepare:types' ({ tsConfig }) {
      tsConfig.include = tsConfig.include!.filter(i => i !== '../../../../**/*')
    }
  }
})
