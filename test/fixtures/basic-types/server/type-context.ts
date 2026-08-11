import { expectTypeOf } from 'vitest'

// @ts-expect-error Fromage is 'cheese'
const _fake: Fromage = 'babybel'

const _fromage: Fromage = 'cheese'

// `AppConfig` is intentionally untyped in server/node programs: user `app.config` files are not
// importable there (#34140), and restating `AppConfig` with a narrower type would conflict with the
// full declaration in `app.config.d.ts` and silently drop user-declared app-config keys (#35996).
const appConfig = useAppConfig()
expectTypeOf(appConfig.fromNuxtConfig).toEqualTypeOf<unknown>()
expectTypeOf(appConfig.userConfig).toEqualTypeOf<unknown>()
expectTypeOf(appConfig.fromLayer).toEqualTypeOf<unknown>()
