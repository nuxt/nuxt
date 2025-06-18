import { createDefu } from 'defu'
import { setResponseHeader } from 'h3'
import type { NitroApp } from 'nitro/types'
import { useRuntimeConfig } from 'nitro/runtime'

// according to https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy#values
export type CSPSourceValue =
  | '\'self\''
  | '\'unsafe-eval\''
  | '\'wasm-unsafe-eval\''
  | '\'unsafe-hashes\''
  | '\'unsafe-inline\''
  | '\'none\''
  | '\'strict-dynamic\''
  | '\'report-sample\''
  | '\'nonce=<base64-value>\''
  // for convenient use of any hosts, protocols, hashes and binaries
  | string

export type CSPSandboxValue =
| 'allow-downloads'
| 'allow-downloads-without-user-activation'
| 'allow-forms'
| 'allow-modals'
| 'allow-orientation-lock'
| 'allow-pointer-lock'
| 'allow-popups'
| 'allow-popups-to-escape-sandbox'
| 'allow-presentation'
| 'allow-same-origin'
| 'allow-scripts'
| 'allow-storage-access-by-user-activation'
| 'allow-top-navigation'
| 'allow-top-navigation-by-user-activation'
| 'allow-top-navigation-to-custom-protocols'

export type ContentSecurityPolicyValue = {
  'child-src'?: CSPSourceValue[] | string | false
  'connect-src'?: CSPSourceValue[] | string | false
  'default-src'?: CSPSourceValue[] | string | false
  'font-src'?: CSPSourceValue[] | string | false
  'frame-src'?: CSPSourceValue[] | string | false
  'img-src'?: CSPSourceValue[] | string | false
  'manifest-src'?: CSPSourceValue[] | string | false
  'media-src'?: CSPSourceValue[] | string | false
  'object-src'?: CSPSourceValue[] | string | false
  'prefetch-src'?: CSPSourceValue[] | string | false
  'script-src'?: CSPSourceValue[] | string | false
  'script-src-elem'?: CSPSourceValue[] | string | false
  'script-src-attr'?: CSPSourceValue[] | string | false
  'style-src'?: CSPSourceValue[] | string | false
  'style-src-elem'?: CSPSourceValue[] | string | false
  'style-src-attr'?: CSPSourceValue[] | string | false
  'worker-src'?: CSPSourceValue[] | string | false
  'base-uri'?: CSPSourceValue[] | string | false
  'sandbox'?: CSPSandboxValue[] | string | false
  'form-action'?: CSPSourceValue[] | string | false
  'frame-ancestors'?: ('\'self\'' | '\'none\'' | string)[] | string | false
  // See https://github.com/w3c/webappsec-csp/pull/564
  // 'navigate-to'?: ("'self'" | "'none'" | "'unsafe-allow-redirects'" | string)[] | string | false;
  'report-uri'?: string[] | string | false
  'report-to'?: string | false
  'require-trusted-types-for'?: string | false
  'trusted-types'?: string[] | string | false
  'upgrade-insecure-requests'?: boolean
}

export type ContentSecurityPolicyConfig = {
  value: ContentSecurityPolicyValue
  nonce: boolean // true
  sri: boolean // true
  ssg: {
    meta: boolean // true
    hashScripts: boolean // true
    hashStyles: boolean // false
    exportToPresets: boolean // true
  }
}

const defaultCSPValue = {
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
}

const defaultCSPConfig: ContentSecurityPolicyConfig = {
  value: defaultCSPValue,
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

export function headerStringFromObject (optionValue: ContentSecurityPolicyValue | false) {
  // False value translates into empty header
  if (optionValue === false) {
    return ''
  }
  // Stringify the options passed as a JS object
  return Object.entries(optionValue)
    .filter(([, value]) => value !== false)
    .map(([directive, sources]) => {
      if (directive === 'upgrade-insecure-requests') {
        return 'upgrade-insecure-requests;'
      } else {
        const stringifiedSources = (typeof sources === 'string')
          ? sources
          : (sources as string[])
              .map(source => source.trim())
              .join(' ')
        return `${directive} ${stringifiedSources};`
      }
    })
    .join(' ')
}

export const defuReplaceArray = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) || Array.isArray(value)) {
    obj[key] = value
    return true
  }
})
