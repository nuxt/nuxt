import { defineEventHandler, getRequestIP, getRouterParam, getRouterParams } from 'nuxt/server'

export default defineEventHandler((event) => {
  return {
    params: getRouterParams(event),
    decoded: getRouterParam(event, 'id', { decode: true }),
    forwardedIP: getRequestIP(event, { xForwardedFor: true }) ?? null,
  }
})
