// TODO: Refactor @nuxt/server related options into `server.js`
import type { ServerResponse } from 'http'
import type { Options as EtagOptions } from 'etag'
import type { IncomingMessage } from 'connect'
import type { CompressionOptions } from 'compression'
import type { ServeStaticOptions } from 'serve-static'
import type { ServerMiddleware } from './_common'

interface PreloadFile {
  asType: 'script' | 'style' | 'font'
  extension: string
  file: string
  fileWithoutQuery: string
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

interface RenderOptions {
  bundleRenderer: {
    shouldPrefetch: (fileWithoutQuery: string, asType: string) => boolean
    shouldPreload: (fileWithoutQuery: string, asType: string) => boolean
    runInNewContext?: boolean
  }
  compressor: CompressionOptions | ServerMiddleware | false
  crossorigin?: 'anonymous' | 'use-credentials' | ''
  csp: boolean | {
    addMeta?: boolean
    allowedSources?: string[]
    hashAlgorithm?: string
    policies?: Record<CspPolicyName, string[]>
    reportOnly?: boolean
    unsafeInlineCompatibility?: boolean
  }
  dist: ServeStaticOptions
  etag: false | EtagOptions & {
    hash?: (html: string) => string
  }
  fallback?: {
    dist?: ServePlaceholderOptions
    static?: ServePlaceholderOptions
  }
  /**
   * @deprecated
   */
  gzip?: CompressionOptions | ServerMiddleware | false
  http2?: {
    push?: boolean
    shouldPush?: boolean | null
    pushAssets?: null | ((
      req: IncomingMessage,
      res: ServerResponse,
      publicPath: string,
      preloadFiles: PreloadFile[]
    ) => string[])
  }
  injectScripts?: boolean
  resourceHints: boolean
  ssr?: boolean
  ssrLog?: boolean | 'collapsed'
  static: ServeStaticOptions & { prefix?: string }
}

export default (): RenderOptions => ({
  bundleRenderer: {
    shouldPrefetch: () => false,
    shouldPreload: (_fileWithoutQuery, asType) => ['script', 'style'].includes(asType),
    runInNewContext: undefined
  },
  crossorigin: undefined,
  resourceHints: true,
  ssr: undefined,
  ssrLog: undefined,
  http2: {
    push: false,
    shouldPush: null,
    pushAssets: null
  },
  static: {},
  compressor: {
    threshold: 0
  },
  etag: {
    weak: false
  },
  csp: false,
  dist: {
    // Don't serve index.html template
    index: false,
    // 1 year in production
    maxAge: '1y'
  },
  // https://github.com/nuxt/serve-placeholder
  fallback: {
    dist: {},
    static: {
      skipUnknown: true,
      handlers: {
        '.htm': false,
        '.html': false
      }
    }
  }
})
