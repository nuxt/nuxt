/**
 * NuxtConfigurationRender
 * Documentation: https://nuxtjs.org/api/configuration-render
 *                https://ssr.vuejs.org/api/#renderer-options
 *                https://github.com/expressjs/compression#readme
 *                https://github.com/expressjs/serve-static#readme
 *                https://github.com/jshttp/etag#readme
 */

import { CompressionOptions } from 'compression'
import { Options as EtagOptions } from 'etag'
import { ServeStaticOptions } from 'serve-static'
import { BundleRendererOptions } from 'vue-server-renderer'
import { NuxtConfigurationServerMiddleware } from './server-middleware'

export interface NuxtConfigurationRender {
  bundleRenderer?: BundleRendererOptions
  compressor?: CompressionOptions | NuxtConfigurationServerMiddleware
  csp?: any // TBD
  dist?: ServeStaticOptions
  etag?: EtagOptions | false
  fallback?: any // https://github.com/nuxt/serve-placeholder types TBD
  http2?: any // TBD
  resourceHints?: boolean
  ssr?: boolean
  static?: ServeStaticOptions
}
