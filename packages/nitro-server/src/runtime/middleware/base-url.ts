import { HTTPError, defineEventHandler } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'

import { urlHash } from '../utils/base'

import '../context'
import { serverFetch } from 'nitro'

const config = useRuntimeConfig()
const baseURL = config.app.baseURL?.replace(/\/$/, '') || '/'
const hasBaseURL = baseURL !== '/' && !/^\.(?:$|\/)/.test(baseURL)

const handler: ReturnType<typeof defineEventHandler> = defineEventHandler((event) => {
  // Prerendered routes are requested (and written out) without the base URL, as the output is
  // deployed at the base rather than served from it.
  if (!hasBaseURL || import.meta.prerender) {
    return
  }

  // avoid processing the same request more than once (detect internal fetches)
  if (event.context.nuxt?.['~internal']) {
    return
  }

  if (event.url.pathname === baseURL || event.url.pathname.startsWith(baseURL + '/')) {
    const newURL = (event.url.pathname.slice(baseURL.length) || '/') + event.url.search + urlHash(event.url)

    return serverFetch(newURL, event.req, {
      nuxt: {
        '~internal': true,
      },
    })
  }

  throw new HTTPError({ status: 404, statusText: `Page not found.` })
})

export default handler
