import { defineEventHandler, getRequestIP, getRouterParam, getRouterParams, getValidatedQuery } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const { page } = await getValidatedQuery(event, query => typeof query.page === 'string' && { page: Number(query.page) })

  return {
    params: getRouterParams(event),
    decoded: getRouterParam(event, 'id', { decode: true }),
    page,
    forwardedIP: getRequestIP(event, { xForwardedFor: true }) ?? null,
  }
})
