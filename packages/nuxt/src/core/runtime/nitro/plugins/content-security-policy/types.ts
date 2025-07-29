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

export type Section = 'body' | 'bodyAppend' | 'bodyPrepend' | 'head'
