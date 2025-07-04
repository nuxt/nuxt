import { describe, expectTypeOf, it } from 'vitest'

describe('routing utilities', () => {
  it('allows using route composables', () => {
    const router = useRouter()
    router.push('/test')

    expectTypeOf(useRouter()).not.toBeAny()
    expectTypeOf(useRoute()).not.toBeAny()

    navigateTo('/thing')
  })
})

describe('auto-imports', () => {
  it('core composables', () => {
    ref()
    useHead({
      script: [],
      // @ts-expect-error Should show error on unknown properties
      unknown: [],
    })
  })
})

describe('config typings', () => {
  it('runtimeConfig', () => {
    const config = useRuntimeConfig()
    expectTypeOf(config.public).toEqualTypeOf<Record<string, unknown>>()
    expectTypeOf(config.app).toEqualTypeOf<{
      baseURL: string
      buildAssetsDir: string
      cdnURL: string
      [key: string]: any
    }>()
  })

  it('appConfig', () => {
    expectTypeOf(useAppConfig().foo).toEqualTypeOf<unknown>()
    expectTypeOf(useAppConfig()).toEqualTypeOf<{
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      nuxt: {}
      [key: string]: unknown
    }>()
  })
})
