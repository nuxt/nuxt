/// <reference path="./config-types.ts" />

import { addTypeTemplate, installModule } from 'nuxt/kit'
import { typescriptBundlerResolution, withMatrix } from '../../matrix'

export default withMatrix({
  extends: [
    './extends/node_modules/foo',
  ],
  theme: './extends/bar',
  modules: [
    'hook-augmenting-module',
    function () {
      addTypeTemplate({
        filename: 'test.d.ts',
        getContents: () => 'declare type Fromage = "cheese"',
      }, { nuxt: true, nitro: true, node: true })
      function _test () {
        installModule('~~/modules/example', {
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
      '~~/modules/example',
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
  routeRules: {
    '/param': {
      redirect: '/param/1',
    },
    '/layout': {
      appLayout: 'custom',
    },
  },
  future: {
    typescriptBundlerResolution,
  },
  experimental: {
    nitroAutoImports: true,
    typedPages: true,
    appManifest: true,
  },
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
    'my-module:augmented-hook' (payload) {
      // Augmented inline by `modules/example.ts`. Sanity check that hook keys
      // augmented from a workspace-module file in the same TS program are
      // accepted by `defineNuxtConfig`.
      payload.message.toUpperCase()
    },
    'hook-augmenting-module:ping' (payload) {
      // Augmented by `_local-modules/hook-augmenting-module/types.d.mts`,
      // which enters the program through `<reference types="hook-augmenting-module" />`
      // generated into `.nuxt/nuxt*.d.ts`.
      //
      // Regression test for the bridge in `packages/nuxt/schema.d.ts`:
      // augments to `@nuxt/schema { interface NuxtHooks }` from a published
      // module entering through a `<reference types>` boundary must reach
      // `NuxtConfig['hooks']` when read via `nuxt/schema` (the path
      // `defineNuxtConfig` takes).
      const _: number = payload.value
    },
  },
})
