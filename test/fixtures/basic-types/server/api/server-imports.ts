import { expectTypeOf } from 'vitest'
import { useAutoRegisteredSession } from '#imports/server'

// route handlers are pulled into the app tsconfig by `nitro-routes.d.ts`, where `#imports` is
// the Vue app's auto-imports; `#imports/server` resolves in both contexts
// https://github.com/nuxt/nuxt/issues/33979
const session = useAutoRegisteredSession()
expectTypeOf(session.id).toEqualTypeOf<'auto-registered-session'>()

export default defineEventHandler(() => session)
