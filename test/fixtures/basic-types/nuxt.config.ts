import { addTypeTemplate, installModule } from 'nuxt/kit'

export default defineNuxtConfig({
  extends: [
    './extends/node_modules/foo',
  ],
  theme: './extends/bar',
  modules: [
    function () {
      addTypeTemplate({
        filename: 'test.d.ts',
        getContents: () => 'declare type Fromage = "cheese"',
      })
      function _test () {
        installModule('~/modules/example', {
          typeTest (val) {
            // @ts-expect-error module type defines val as boolean
            const b: string = val
            return !!b
          },
        })
      }
    },
    './modules/test',
    [
      '~/modules/example',
      {
        typeTest (val) {
          // @ts-expect-error module type defines val as boolean
          const b: string = val
          return !!b
        },
      },
    ],
    function (_options, nuxt) {
      nuxt.hook('pages:extend', (pages) => {
        pages.push({
          name: 'internal-async-parent',
          path: '/internal-async-parent',
        })
      })
    },
  ],
  app: {
    head: {
      // @ts-expect-error Promises are not allowed
      title: Promise.resolve('Nuxt Fixture'),
      // @ts-expect-error Functions are not allowed
      titleTemplate: title => 'test',
      meta: [
        {
          // Allows unknown property
          property: 'og:thing',
          content: '1234567890',
        },
      ],
    },
    pageTransition: {
      // @ts-expect-error Functions are not allowed
      onBeforeEnter: el => console.log(el),
    },
  },
  appConfig: {
    fromNuxtConfig: true,
    nested: {
      val: 1,
    },
  },
  runtimeConfig: {
    baseURL: '',
    baseAPIToken: '',
    privateConfig: 'secret_key',
    public: {
      ids: [1, 2, 3],
      needsFallback: undefined,
      testConfig: 123,
    },
  },
  buildDir: process.env.NITRO_BUILD_DIR,
  builder: process.env.TEST_BUILDER as 'webpack' | 'rspack' | 'vite' ?? 'vite',
  routeRules: {
    '/param': {
      redirect: '/param/1',
    },
  },
  future: {
    typescriptBundlerResolution: process.env.MODULE_RESOLUTION === 'bundler',
    compatibilityVersion: process.env.TEST_V4 === 'true' ? 4 : 3,
  },
  experimental: {
    typedPages: true,
    appManifest: true,
  },
  compatibilityDate: '2024-06-28',
  telemetry: false, // for testing telemetry types - it is auto-disabled in tests
  hooks: {
    'schema:extend' (schemas) {
      schemas.push({
        appConfig: {
          someThing: {
            value: {
              $default: 'default',
              $schema: {
                tsType: 'string | false',
              },
            },
          },
        },
      })
    },
    'prepare:types' ({ tsConfig }) {
      tsConfig.include = tsConfig.include!.filter(i => i !== '../../../../**/*')
    },
  },
})
