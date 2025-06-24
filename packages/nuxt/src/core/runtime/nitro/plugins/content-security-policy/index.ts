import { setResponseHeader } from 'h3'
import type { NitroApp } from 'nitro/types'
import { useRuntimeConfig } from 'nitro/runtime'
import type { ContentSecurityPolicyConfig } from './types'
import { defuReplaceArray, headerStringFromObject } from './utils'

const defaultCSPConfig: ContentSecurityPolicyConfig = {
  value: {
    'base-uri': ['\'none\''],
    'font-src': ['\'self\'', 'https:', 'data:'],
    'form-action': ['\'self\''],
    'frame-ancestors': ['\'self\''],
    'img-src': ['\'self\'', 'data:'],
    'object-src': ['\'none\''],
    'script-src-attr': ['\'none\''],
    'style-src': ['\'self\'', 'https:', '\'unsafe-inline\''],
    'script-src': ['\'self\'', 'https:', '\'unsafe-inline\'', '\'strict-dynamic\'', '\'nonce-{{nonce}}\''],
    'upgrade-insecure-requests': true,
  },
  nonce: true,
  sri: true,
  ssg: {
    meta: true,
    hashScripts: true,
    hashStyles: false,
    exportToPresets: true,
  },
}

/**
 * This plugin sets the Content Security Policy header for the response.
 */
export default (nitroApp: NitroApp) => {
  nitroApp.hooks.hook('render:response', (_, { event }) => {
    const config = useRuntimeConfig(event)
    const cspConfigFromUser = config.contentSecurityPolicy || {}
    const contentSecurityPolicyConfig: ContentSecurityPolicyConfig = defuReplaceArray({ ...cspConfigFromUser }, { ...defaultCSPConfig })

    const headerValue = headerStringFromObject(contentSecurityPolicyConfig.value)
    setResponseHeader(event, 'content-security-policy', headerValue)
  })
}
