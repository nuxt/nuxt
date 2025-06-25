import { describe, expectTypeOf, it } from 'vitest'

import type { AppConfig, RuntimeValue, UpperSnakeCase } from 'nuxt/schema'
import { defineNuxtModule } from 'nuxt/kit'
import { defineNuxtConfig } from 'nuxt/config'

describe('modules', () => {
  it('augments schema automatically', () => {
    defineNuxtConfig({ sampleModule: { enabled: false } })
    // @ts-expect-error we want to ensure we throw type error on invalid option
    defineNuxtConfig({ sampleModule: { other: false } })
    // @ts-expect-error we want to ensure we throw type error on invalid key
    defineNuxtConfig({ undeclaredKey: { other: false } })
  })

  it('preserves options in defineNuxtModule setup without `.with()`', () => {
    defineNuxtModule<{ foo?: string, baz: number }>({
      defaults: {
        baz: 100,
      },
      setup: (resolvedOptions) => {
        expectTypeOf(resolvedOptions).toEqualTypeOf<{ foo?: string, baz: number }>()
      },
    })
  })

  it('correctly typed resolved options in defineNuxtModule setup using `.with()`', () => {
    defineNuxtModule<{
      foo?: string
      baz: number
    }>().with({
      defaults: {
        foo: 'bar',
      },
      setup: (resolvedOptions) => {
        expectTypeOf(resolvedOptions).toEqualTypeOf<{
          foo: string
          baz?: number | undefined
        }>()
      },
    })
  })
})

describe('runtimeConfig', () => {
  it('provides hints on overriding these values', () => {
    const val = defineNuxtConfig({
      runtimeConfig: {
        public: {
          // @ts-expect-error this should be a number
          testConfig: 'test',
          ids: [1, 2],
        },
      },
    })
    expectTypeOf(val.runtimeConfig!.public!.testConfig).toEqualTypeOf<undefined | RuntimeValue<number, 'You can override this value at runtime with NUXT_PUBLIC_TEST_CONFIG'>>()
    expectTypeOf(val.runtimeConfig!.privateConfig).toEqualTypeOf<undefined | RuntimeValue<string, 'You can override this value at runtime with NUXT_PRIVATE_CONFIG'>>()
    expectTypeOf(val.runtimeConfig!.baseURL).toEqualTypeOf<undefined | RuntimeValue<string, 'You can override this value at runtime with NUXT_BASE_URL'>>()
    expectTypeOf(val.runtimeConfig!.baseAPIToken).toEqualTypeOf<undefined | RuntimeValue<string, 'You can override this value at runtime with NUXT_BASE_API_TOKEN'>>()
    expectTypeOf(val.runtimeConfig!.public!.ids).toEqualTypeOf<undefined | RuntimeValue<(1 | 2 | 3)[], 'You can override this value at runtime with NUXT_PUBLIC_IDS'>>()
    expectTypeOf(val.runtimeConfig!.unknown).toEqualTypeOf<unknown>()
  })

  it('correctly converts different kinds of names to snake case', () => {
    expectTypeOf<UpperSnakeCase<'testAppName'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'TEST_APP_NAME'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'test_APP_NAME'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'test_app_NAME'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'testAppNAME'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'testApp123NAME'>>().toEqualTypeOf<'TEST_APP123NAME'>()
    expectTypeOf<UpperSnakeCase<'testAPPName'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'testAPP_Name'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'test_APP_Name'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'TESTAppName'>>().toEqualTypeOf<'TEST_APP_NAME'>()
    expectTypeOf<UpperSnakeCase<'t'>>().toEqualTypeOf<'T'>()
    expectTypeOf<UpperSnakeCase<'T'>>().toEqualTypeOf<'T'>()
  })
})

describe('head', () => {
  it('correctly types nuxt.config options', () => {
    // @ts-expect-error invalid head option
    defineNuxtConfig({ app: { head: { titleTemplate: () => 'test' } } })
    defineNuxtConfig({
      app: {
        head: {
          meta: [{ key: 'key', name: 'description', content: 'some description ' }],
          titleTemplate: 'test %s',
        },
      },
    })
  })
})

describe('app config', () => {
  it('merges app config as expected', () => {
    interface ExpectedMergedAppConfig {
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      nuxt: {}
      fromLayer: boolean
      fromNuxtConfig: boolean
      nested: {
        val: number
      }
      userConfig: 123 | 456
      someThing?: {
        value?: string | false
      }
      [key: string]: unknown
    }
    expectTypeOf<AppConfig>().toEqualTypeOf<ExpectedMergedAppConfig>()
  })
})

describe('extends type declarations', () => {
  it('correctly adds references to tsconfig', () => {
    expectTypeOf<import('bing').BingInterface>().toEqualTypeOf<{ foo: 'bar' }>()
  })
})

describe('kit utilities', () => {
  it('addTypeTemplate', () => {
    // @ts-expect-error Fromage is 'cheese'
    const _fake: Fromage = 'babybel'

    const _fromage: Fromage = 'cheese'
  })
})
