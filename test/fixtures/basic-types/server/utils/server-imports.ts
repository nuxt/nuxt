import { expectTypeOf } from 'vitest'
import { useAutoRegisteredSession } from '#imports/server'

// the issue covers the whole server directory, not only route handlers
export function getAutoRegisteredSessionId () {
  const id = useAutoRegisteredSession().id
  expectTypeOf(id).toEqualTypeOf<'auto-registered-session'>()
  return id
}
