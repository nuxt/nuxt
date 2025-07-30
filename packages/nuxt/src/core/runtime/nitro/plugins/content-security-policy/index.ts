import { setResponseHeader } from 'h3'
import type { NitroApp } from 'nitro/types'
import { useRuntimeConfig } from 'nitro/runtime'
import type { ContentSecurityPolicyConfig } from './types'
import { defuReplaceArray, headerStringFromObject } from './utils'
import { generateNonce } from './nonce'
import { updateCsp } from './update-csp'
import { addCspToMeta } from './meta'
import { generateSSGHashes } from './ssg-hashes'
import { generateSubresourceIntegrity } from './sri'

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
 * This plugin sets the Content Security Policy header for the response. It also sets smaller plugins like nonce, meta, ssg-hashes.
 */
export default (nitroApp: NitroApp) => {
  const config = useRuntimeConfig()
  const cspConfigFromUser = config.contentSecurityPolicy || {}
  const contentSecurityPolicyConfig: ContentSecurityPolicyConfig = defuReplaceArray({ ...cspConfigFromUser }, { ...defaultCSPConfig })

  nitroApp.hooks.hook('render:response', (_, { event }) => {
    const headerValue = headerStringFromObject(contentSecurityPolicyConfig.value)
    setResponseHeader(event, 'content-security-policy', headerValue)
  })

  if (contentSecurityPolicyConfig.nonce) {
    generateNonce(nitroApp, contentSecurityPolicyConfig)
  }

  if (contentSecurityPolicyConfig.ssg.meta) {
    addCspToMeta(nitroApp, contentSecurityPolicyConfig)
  }

  if (contentSecurityPolicyConfig.ssg.hashScripts || contentSecurityPolicyConfig.ssg.hashStyles) {
    generateSSGHashes(nitroApp, contentSecurityPolicyConfig)
  }

  if (contentSecurityPolicyConfig.sri) {
    generateSubresourceIntegrity(nitroApp, contentSecurityPolicyConfig)
  }

  updateCsp(nitroApp, contentSecurityPolicyConfig)
}
