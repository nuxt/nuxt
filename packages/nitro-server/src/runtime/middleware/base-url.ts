import { createError, defineEventHandler, defineLazyEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitro/runtime'

export default defineLazyEventHandler(() => {
  const config = useRuntimeConfig()
  const baseURL = config.app.baseURL?.replace(/\/$/, '') || '/'

  if (baseURL === '/' || /^\.(?:$|\/)/.test(baseURL)) {
    // no-op
    return () => {}
  }

  const errorBase = `${baseURL}/__nuxt_error`

  return defineEventHandler((event) => {
    // avoid processing the same request more than once (detect internal fetches)
    if (!event.req.runtime && !event.url.pathname.startsWith(errorBase)) {
      return
    }

    if (event.url.pathname.startsWith(baseURL)) {
      const newURL = (event.url.pathname.slice(baseURL.length) || '/') + event.url.search + event.url.hash
      return fetch(newURL, event.req)
    }

    throw createError({ status: 404, statusText: `Page not found.` })
  })
})
