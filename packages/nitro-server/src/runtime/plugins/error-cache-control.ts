import { definePlugin } from 'nitro'
import type { H3Event } from 'nitro/h3'

import { isRenderedErrorPage } from '../utils/error-page'

/**
 * h3 sends the headers of a `headers` route rule with an error page the renderer renders
 * itself, so the rule's `cache-control` is replaced there.
 */
export default definePlugin((nitroApp) => {
  nitroApp.hooks?.hook('response', (response, event) => {
    const context = (event as H3Event).context
    if (response.status < 400 || !isRenderedErrorPage(context)) { return }
    const rule = ruleCacheControl(context.routeRules?.headers)
    if (rule && response.headers.get('cache-control') === rule) {
      response.headers.set('cache-control', 'no-cache')
    }
  })
})

function ruleCacheControl (headers: Record<string, string> | undefined): string | undefined {
  for (const name in headers) {
    if (name.toLowerCase() === 'cache-control') {
      return headers[name]
    }
  }
}
