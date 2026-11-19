import { definePlugin } from 'nitro'
import type { H3Event } from 'nitro/h3'

import { errorCacheControl, ruleCacheControl } from '../utils/cache-control'
import { isRenderedErrorPage } from '../utils/error-page'

/**
 * h3 sends the headers of a `headers` route rule with an error page the renderer renders
 * itself, and none of them with an error response an error handler returns. Such a response
 * that sends the rule's `cache-control`, or none, is sent with the one `errorCacheControl`
 * picks for the rule.
 */
export default definePlugin((nitroApp) => {
  nitroApp.hooks?.hook('response', (response, event) => {
    if (response.status < 400) { return }
    const rule = ruleCacheControl(event as H3Event)
    if (!rule) { return }
    const value = response.headers.get('cache-control')
    if (value === null || (value === rule && isRenderedErrorPage((event as H3Event).context))) {
      response.headers.set('cache-control', errorCacheControl(rule))
    }
  })
})
