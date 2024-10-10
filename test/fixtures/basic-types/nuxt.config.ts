import { addTypeTemplate, installModule } from 'nuxt/kit'

export default defineNuxtConfig({
  compatibilityDate: '2024-06-28',
  experimental: {
    typedPages: true,
    appManifest: true,
  },
  future: {
    typescriptBundlerResolution: process.env.MODULE_RESOLUTION === 'bundler',
  },
  builder: process.env.TEST_BUILDER as 'webpack' | 'rspack' | 'vite' ?? 'vite',
  theme: './extends/bar',
  extends: [
    './extends/node_modules/foo',
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
  appConfig: {
    fromNuxtConfig: true,
    nested: {
      val: 1,
    },
  },
  routeRules: {
    '/param': {
      redirect: '/param/1',
    },
  },
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
