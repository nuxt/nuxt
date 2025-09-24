import { setResponseHeader } from 'h3'
import type { NitroApp } from 'nitropack/types'
import { headerStringFromObject } from './utils'
// @ts-expect-error : we are importing from the virtual file system
import contentSecurityPolicyConfig from '#content-security-policy'
import type { ContentSecurityPolicyConfig } from '../../../types'

/**
 * This plugin sets the Content Security Policy header for the response. It also sets smaller plugins like nonce, meta, ssg-hashes.
 */
export default (nitroApp: NitroApp) => {
  const cspConfig = contentSecurityPolicyConfig as ContentSecurityPolicyConfig

  nitroApp.hooks.hook('render:response', (_, { event }) => {
    const headerValue = headerStringFromObject(cspConfig.value)
    setResponseHeader(event, 'content-security-policy', headerValue)
  })
}
