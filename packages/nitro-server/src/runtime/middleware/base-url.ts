import { HTTPError, defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitro/runtime'

const config = useRuntimeConfig()
const baseURL = config.app.baseURL?.replace(/\/$/, '') || '/'
const hasBaseURL = baseURL !== '/' && !/^\.(?:$|\/)/.test(baseURL)
const errorBase = `${baseURL}/__nuxt_error`

export default defineEventHandler((event) => {
  if (!hasBaseURL) {
    return
  }

  // avoid processing the same request more than once (detect internal fetches)
  if (!event.req.runtime && !event.url.pathname.startsWith(errorBase)) {
    return
  }

  if (event.url.pathname.startsWith(baseURL)) {
    const newURL = (event.url.pathname.slice(baseURL.length) || '/') + event.url.search + event.url.hash
    return fetch(newURL, event.req)
  }

  throw new HTTPError({ status: 404, statusText: `Page not found.` })
})
