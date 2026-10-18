import { defineEventHandler } from 'h3'
import { getRouteRules } from 'nitropack/runtime'

export default defineEventHandler(event => ({
  fromHelper: getRouteRules(event),
  // @ts-expect-error nitro v2 populated this private slot, and modules read it directly
  fromContext: event.context._nitro.routeRules,
}))
