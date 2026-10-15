import type { NitroApp } from 'nitropack/types'

import { resolveRequestRouteRules } from '../utils/route-rules'

// nitropack reuses `event.context._nitro.routeRules` once resolved, so assigning it before its
// route rules handler runs applies `redirect`, `headers` and `proxy` with Nuxt's matching
export default (nitroApp: NitroApp): void => {
  nitroApp.hooks.hook('request', (event) => {
    event.context._nitro ||= {}
    event.context._nitro.routeRules = resolveRequestRouteRules(event)
  })
}
