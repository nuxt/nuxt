import type { NitroApp } from 'nitro/types'
import type { ContentSecurityPolicyConfig } from './types'
import { headerStringFromObject } from './utils'

export const addCspToMeta = (nitroApp: NitroApp, cspConfig: ContentSecurityPolicyConfig) => {
  if (!import.meta.prerender) {
    return
  }

  nitroApp.hooks.hook('render:html', (html) => {
    // Exit if no need to parse HTML for this route
    if (!cspConfig.value) {
      return
    }

    if (cspConfig.ssg && cspConfig.ssg.meta && cspConfig.value) {
      const csp = structuredClone(cspConfig.value)
      csp['frame-ancestors'] = false
      const headerValue = headerStringFromObject(csp)

      // Let's insert the CSP meta tag just after the first tag which should be the charset meta
      let insertIndex = 0
      if (html.head.length > 0) {
        const headFirst = html.head[0]
        if (typeof headFirst === 'string') {
          const metaCharsetMatch = headFirst.match(/^<meta charset="(.*?)">/dim)
          if (metaCharsetMatch && metaCharsetMatch.indices && metaCharsetMatch.indices[0]) {
            insertIndex = metaCharsetMatch.indices[0][1]
          }
          html.head[0] = headFirst.slice(0, insertIndex) + `<meta http-equiv="Content-Security-Policy" content="${headerValue}">` + headFirst.slice(insertIndex)
        }
      }
    }
  })
}
