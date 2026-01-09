import { HTTPError, defineEventHandler } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { serverFetch } from 'nitro'

const config = useRuntimeConfig()
const baseURL = config.app.baseURL?.replace(/\/$/, '') || '/'
const hasBaseURL = baseURL !== '/' && !/^\.(?:$|\/)/.test(baseURL)

export default defineEventHandler((event) => {
  if (!hasBaseURL) {
    return
  }

  // avoid processing the same request more than once (detect internal fetches)
  if (event.context.nuxt?.['~internal']) {
    return
  }

  if (event.url.pathname.startsWith(baseURL)) {
    const newURL = (event.url.pathname.slice(baseURL.length) || '/') + event.url.search + event.url.hash

    return serverFetch(newURL, event.req, {
      nuxt: {
        '~internal': true,
      },
    })
  }

  throw new HTTPError({ status: 404, statusText: `Page not found.` })
})
