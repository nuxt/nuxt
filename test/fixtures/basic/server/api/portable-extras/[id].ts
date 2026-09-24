import { defineEventHandler, getRequestIP, getRouterParam, getRouterParams, getValidatedQuery, handleCors, useAppConfig } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const preflight = handleCors(event, { origin: ['https://nuxt.com'] })
  if (preflight) {
    return preflight
  }

  const { page } = await getValidatedQuery(event, query => typeof query.page === 'string' && { page: Number(query.page) })

  return {
    params: getRouterParams(event),
    decoded: getRouterParam(event, 'id', { decode: true }),
    page,
    appConfig: useAppConfig(event).fromLayer ?? null,
    forwardedIP: getRequestIP(event, { xForwardedFor: true }) ?? null,
  }
})
