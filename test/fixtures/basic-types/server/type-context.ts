import { expectTypeOf } from 'vitest'

// @ts-expect-error Fromage is 'cheese'
const _fake: Fromage = 'babybel'

const _fromage: Fromage = 'cheese'

const appConfig = useAppConfig()
expectTypeOf(appConfig.fromNuxtConfig).toEqualTypeOf<boolean>()
expectTypeOf(appConfig.userConfig).toEqualTypeOf<123 | 456 | undefined>()
expectTypeOf(appConfig.fromLayer).toEqualTypeOf<unknown>()
