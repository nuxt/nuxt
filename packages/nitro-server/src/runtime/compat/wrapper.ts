import { getRouteRules } from '../utils/route-rules.ts'
import { wrapLegacyHandler as wrap } from './legacy-handler.ts'

/**
 * Wrap a handler written for nitro v2 so it sees the event and error shape it expects,
 * with the route rules nitro matched for the request.
 */
export function wrapLegacyHandler (input: unknown, base?: string): unknown {
  return wrap(input, base, getRouteRules)
}
