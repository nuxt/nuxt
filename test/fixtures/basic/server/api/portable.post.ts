import { createError, defineEventHandler, deleteCookie, getCookie, getQuery, getRequestHeader, getRequestURL, isNuxtError, readBody, sendRedirect, setCookie, setResponseHeader, setResponseStatus, useRuntimeConfig } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const { fail, redirect } = getQuery<{ fail?: string, redirect?: string }>(event)

  if (fail) {
    const error = createError({ status: 418, statusText: 'Teapot', data: { fail } })
    // the status is readable under the names the portable surface declares, whichever
    // server runtime constructed the error
    if (!isNuxtError(error) || error.status !== 418 || error.statusText !== 'Teapot') {
      throw createError({ status: 500, statusText: 'an error from `nuxt/server` is not portable' })
    }
    throw error
  }

  if (redirect) {
    return sendRedirect(event, '/login')
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
