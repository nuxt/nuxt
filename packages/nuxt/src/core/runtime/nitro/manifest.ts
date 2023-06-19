import { defineEventHandler } from "h3"
// @ts-expect-error Virtual file
import { hashId, buildTimestamp } from '#app-manifest'
import { useRuntimeConfig } from "#internal/nitro"

export default defineEventHandler(async event => {
  const routeRules = {} as Record<string, any>
  const _routeRules = useRuntimeConfig().nitro.routeRules
  for (const key in _routeRules) {
    if (key === '/__nuxt_error') { continue }
    const filteredRules = Object.entries(_routeRules[key])
      .filter(([key]) => ['prerender', 'redirect'].includes(key))
      .map(([key, value]: any) => {
        if (key === 'redirect') {
          return [key, typeof value === 'string' ? value : value.to]
        }
        return [key, value]
      })
    if (filteredRules.length > 0) {
      routeRules[key] = Object.fromEntries(filteredRules)
    }
  }

  return {
    id: hashId,
    timestamp: buildTimestamp,
    routeRules,
    prerendered: '__NUXT_PRERENDERED_ROUTES__'
  }
})
