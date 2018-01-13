const generateETag = require('etag')
const fresh = require('fresh')

const { getContext } = require('../../common/utils')

module.exports = async function nuxtMiddleware(req, res, next) {
  // Get context
  const context = getContext(req, res)

  res.statusCode = 200
  try {
    const result = await this.renderRoute(req.url, context)
    await this.nuxt.callHook('render:route', req.url, result)
    const {
      html,
      cspScriptSrcHashes,
      error,
      redirected,
      getPreloadFiles
    } = result

    if (redirected) {
      return html
    }
    if (error) {
      res.statusCode = context.nuxt.error.statusCode || 500
    }

    // Add ETag header
    if (!error && this.options.render.etag) {
      const etag = generateETag(html, this.options.render.etag)
      if (fresh(req.headers, { etag })) {
        res.statusCode = 304
        res.end()
        return
      }
      res.setHeader('ETag', etag)
    }

    // HTTP2 push headers for preload assets
    if (!error && this.options.render.http2.push) {
      // Parse resourceHints to extract HTTP.2 prefetch/push headers
      // https://w3c.github.io/preload/#server-push-http-2
      const pushAssets = []
      const preloadFiles = getPreloadFiles()
      const { shouldPush } = this.options.render.http2
      const { publicPath } = this.resources.clientManifest

      preloadFiles.forEach(({ file, asType, fileWithoutQuery, extension }) => {
        // By default, we only preload scripts or css
        /* istanbul ignore if */
        if (!shouldPush && asType !== 'script' && asType !== 'style') {
          return
        }

        // User wants to explicitly control what to preload
        if (shouldPush && !shouldPush(fileWithoutQuery, asType)) {
          return
        }

        pushAssets.push(`<${publicPath}${file}>; rel=preload; as=${asType}`)
      })

      // Pass with single Link header
      // https://preloadFilesblog.cloudflare.com/http-2-server-push-with-multiple-assets-per-link-header
      // https://www.w3.org/Protocols/9707-link-header.html
      res.setHeader('Link', pushAssets.join(','))
    }

    if (this.options.render.csp) {
      res.setHeader(
        'Content-Security-Policy',
        `script-src 'self' ${(cspScriptSrcHashes || []).join(' ')}`
      )
    }

    // Send response
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(html))
    res.end(html, 'utf8')
    return html
  } catch (err) {
    /* istanbul ignore if */
    if (context && context.redirected) {
      console.error(err) // eslint-disable-line no-console
      return err
    }

    next(err)
  }
}
