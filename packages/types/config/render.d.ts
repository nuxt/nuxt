/**
 * NuxtOptionsRender
 * Documentation: https://nuxtjs.org/api/configuration-render
 *                https://ssr.vuejs.org/api/#renderer-options
 *                https://github.com/expressjs/compression#readme
 *                https://github.com/expressjs/serve-static#readme
 *                https://github.com/jshttp/etag#readme
 */

import { ServerResponse } from 'http'
import { CompressionOptions } from 'compression'
import { IncomingMessage } from 'connect'
import { Options as EtagOptions } from 'etag'
import { ServeStaticOptions } from 'serve-static'
import { BundleRendererOptions } from 'vue-server-renderer'
import { NuxtOptionsServerMiddleware } from './server-middleware'

type NuxtEtagOptions = EtagOptions & {
  hash?: (html: string) => string
}

type ServePlaceholderHandler = 'default' | 'css' | 'html' | 'js' | 'json' | 'map' | 'plain' | 'image'
interface ServePlaceholderOptions {
  handlers?: Record<string, ServePlaceholderHandler | null | false>
  mimes?: Record<ServePlaceholderHandler, string | false | undefined>
  noCache?: boolean
  placeholders?: Record<ServePlaceholderHandler, string | Buffer | false>
  skipUnknown?: boolean
  statusCode?: false | number
}

type CspPolicyName = 'child-src' | 'connect-src' | 'default-src' | 'font-src' | 'frame-src' | 'img-src' | 'manifest-src' | 'media-src' | 'object-src' | 'prefetch-src' | 'script-src' | 'script-src-elem' | 'script-src-attr' | 'style-src' | 'style-src-elem' | 'style-src-attr' | 'worker-src' | 'base-uri' | 'plugin-types' | 'sandbox' | 'form-action' | 'frame-ancestors' | 'navigate-to' | 'report-uri' | 'report-to' | 'block-all-mixed-content' | 'referrer' | 'require-sri-for' | 'trusted-types' | 'upgrade-insecure-requests'
interface CspOptions {
  addMeta?: boolean
  allowedSources?: string[]
  hashAlgorithm?: string
  policies?: Record<CspPolicyName, string[]>
  reportOnly?: boolean
  unsafeInlineCompatibility?: boolean
}

interface PreloadFile {
  asType: 'script' | 'style' | 'font'
  extension: string
  file: string
  fileWithoutQuery: string
}

export interface NuxtOptionsRender {
  bundleRenderer?: BundleRendererOptions
  compressor?: CompressionOptions | NuxtOptionsServerMiddleware | false
  csp?: boolean | CspOptions
  crossorigin?: "anonymous" | "use-credentials" | ""
  dist?: ServeStaticOptions
  etag?: NuxtEtagOptions | false
  fallback?: {
    dist?: ServePlaceholderOptions
    static?: ServePlaceholderOptions
  }
  http2?: {
    push?: boolean
    shouldPush?: boolean
    pushAssets?: (
      req: IncomingMessage,
      res: ServerResponse,
      publicPath: string,
      preloadFiles: PreloadFile[]
    ) => string[]
  }
  injectScripts?: boolean
  resourceHints?: boolean
  ssr?: boolean
  ssrLog?: boolean | 'collapsed'
  static?: ServeStaticOptions
}
