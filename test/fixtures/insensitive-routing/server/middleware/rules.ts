import { defineEventHandler, getQuery, getRouteRules } from 'nuxt/server'

export default defineEventHandler((event) => {
  if ('rules' in getQuery(event)) {
    return getRouteRules(event)
  }
})
