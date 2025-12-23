import { getRouteRulesForPath } from 'nitropack/runtime/internal'
import { defineEventHandler, getQuery } from '#imports'

export default defineEventHandler((event) => {
  const { path } = getQuery(event)
  if (typeof path !== 'string') {
    return {}
  }
  return getRouteRulesForPath(path)
})
