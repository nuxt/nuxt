import { createError, deleteCookie, getCookie, getQuery, getRequestHeader, getRequestURL, readBody, setCookie, setResponseHeader, setResponseStatus, useRuntimeConfig } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const { fail } = getQuery<{ fail?: string }>(event)
  if (fail) {
    throw createError({ status: 418, statusText: 'Teapot', data: { fail } })
  }

  const body = await readBody<{ name?: string }>(event)

  setResponseStatus(event, 201)
  setResponseHeader(event, 'x-portable', 'yes')
  setCookie(event, 'portable', 'set')
  deleteCookie(event, 'stale')

  return {
    name: body.name ?? null,
    path: getRequestURL(event).pathname,
    accept: getRequestHeader(event, 'accept') ?? null,
    incoming: getCookie(event, 'incoming') ?? null,
    publicKey: useRuntimeConfig().public.testConfig,
  }
})
