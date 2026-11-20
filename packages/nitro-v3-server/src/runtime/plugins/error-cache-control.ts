import { definePlugin } from 'nitro'
import type { H3Event } from 'nitro/h3'

import { errorCacheControl, ruleCacheControl } from '../utils/cache-control'
import { isRenderedErrorPage } from '../utils/error-page'

/**
 * h3 sends the headers of a `headers` route rule with an error page the renderer renders
 * itself, and none of them with an error response an error handler returns. Such a response
 * that sends the rule's `cache-control`, or none, is sent with the one `errorCacheControl`
 * picks for the rule, as is an error page the renderer renders without a `cache-control`.
 */
export default definePlugin((nitroApp) => {
  nitroApp.hooks?.hook('response', (response, event) => {
    if (response.status < 400) { return }
    const rule = ruleCacheControl(event as H3Event)
    const value = response.headers.get('cache-control')
    const errorPage = isRenderedErrorPage((event as H3Event).context)
    if (value === null ? (rule || errorPage) : (rule && value === rule && errorPage)) {
      response.headers.set('cache-control', errorCacheControl(rule))
    }
  })
})
