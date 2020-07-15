import generateETag from 'etag'
import fresh from 'fresh'
import consola from 'consola'

import { getContext, TARGETS } from 'nuxt/utils'

export default ({ options, nuxt, renderRoute, resources }) => async function nuxtMiddleware (req, res, next) {
  // Get context
  const context = getContext(req, res)

  try {
    const url = decodeURI(req.url)
    res.statusCode = 200
    const result = await renderRoute(url, context)

    // If result is falsy, call renderLoading
    if (!result) {
      await nuxt.callHook('server:nuxt:renderLoading', req, res)
      return
    }

    await nuxt.callHook('render:route', url, result, context)
    const {
      html,
      cspScriptSrcHashes,
      error,
      redirected,
      preloadFiles
    } = result

    if (redirected && context.target !== TARGETS.static) {
      await nuxt.callHook('render:routeDone', url, result, context)
      return html
    }
    if (error) {
      res.statusCode = context.nuxt.error.statusCode || 500
    }

    // Add ETag header
    if (!error && options.render.etag) {
      const { hash } = options.render.etag
      const etag = hash ? hash(html, options.render.etag) : generateETag(html, options.render.etag)
      if (fresh(req.headers, { etag })) {
        res.statusCode = 304
        await nuxt.callHook('render:beforeResponse', url, result, context)
        res.end()
        await nuxt.callHook('render:routeDone', url, result, context)
        return
      }
      res.setHeader('ETag', etag)
    }

    // HTTP2 push headers for preload assets
    if (!error && options.render.http2.push) {
      // Parse resourceHints to extract HTTP.2 prefetch/push headers
      // https://w3c.github.io/preload/#server-push-http-2
      const { shouldPush, pushAssets } = options.render.http2
      const { publicPath } = resources.clientManifest

      const links = pushAssets
        ? pushAssets(req, res, publicPath, preloadFiles)
        : defaultPushAssets(preloadFiles, shouldPush, publicPath, options)

      // Pass with single Link header
      // https://blog.cloudflare.com/http-2-server-push-with-multiple-assets-per-link-header
      // https://www.w3.org/Protocols/9707-link-header.html
      if (links.length > 0) {
        res.setHeader('Link', links.join(', '))
      }
    }

    if (options.render.csp && cspScriptSrcHashes) {
      const { allowedSources, policies } = options.render.csp
      const isReportOnly = !!options.render.csp.reportOnly
      const cspHeader = isReportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'

      res.setHeader(cspHeader, getCspString({ cspScriptSrcHashes, allowedSources, policies, isDev: options.dev, isReportOnly }))
    }

    // Send response
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Accept-Ranges', 'none') // #3870
    res.setHeader('Content-Length', Buffer.byteLength(html))
    await nuxt.callHook('render:beforeResponse', url, result, context)
    res.end(html, 'utf8')
    await nuxt.callHook('render:routeDone', url, result, context)
    return html
  } catch (err) {
    if (context && context.redirected) {
      consola.error(err)
      return err
    }

    if (err.name === 'URIError') {
      err.statusCode = 400
    }
    next(err)
  }
}

const defaultPushAssets = (preloadFiles, shouldPush, publicPath, options) => {
  if (shouldPush && options.dev) {
    consola.warn('http2.shouldPush is deprecated. Use http2.pushAssets function')
  }

  const links = []
  preloadFiles.forEach(({ file, asType, fileWithoutQuery, modern }) => {
    // By default, we only preload scripts or css
    if (!shouldPush && asType !== 'script' && asType !== 'style') {
      return
    }

    // User wants to explicitly control what to preload
    if (shouldPush && !shouldPush(fileWithoutQuery, asType)) {
      return
    }

    const { crossorigin } = options.render
    const cors = `${crossorigin ? ` crossorigin=${crossorigin};` : ''}`
    // `modulepreload` rel attribute only supports script-like `as` value
    // https://html.spec.whatwg.org/multipage/links.html#link-type-modulepreload
    const rel = modern && asType === 'script' ? 'modulepreload' : 'preload'

    links.push(`<${publicPath}${file}>; rel=${rel};${cors} as=${asType}`)
  })
  return links
}

const getCspString = ({ cspScriptSrcHashes, allowedSources, policies, isDev, isReportOnly }) => {
  const joinedHashes = cspScriptSrcHashes.join(' ')
  const baseCspStr = `script-src 'self'${isDev ? ' \'unsafe-eval\'' : ''} ${joinedHashes}`
  const policyObjectAvailable = typeof policies === 'object' && policies !== null && !Array.isArray(policies)

  if (Array.isArray(allowedSources) && allowedSources.length) {
    return isReportOnly && policyObjectAvailable && !!policies['report-uri'] ? `${baseCspStr} ${allowedSources.join(' ')}; report-uri ${policies['report-uri']};` : `${baseCspStr} ${allowedSources.join(' ')}`
  }

  if (policyObjectAvailable) {
    const transformedPolicyObject = transformPolicyObject(policies, cspScriptSrcHashes)
    return Object.entries(transformedPolicyObject).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(' ') : v}`).join('; ')
  }

  return baseCspStr
}

const transformPolicyObject = (policies, cspScriptSrcHashes) => {
  const userHasDefinedScriptSrc = policies['script-src'] && Array.isArray(policies['script-src'])

  const additionalPolicies = userHasDefinedScriptSrc ? policies['script-src'] : []

  // Self is always needed for inline-scripts, so add it, no matter if the user specified script-src himself.
  const hashAndPolicyList = cspScriptSrcHashes.concat('\'self\'', additionalPolicies)

  return { ...policies, 'script-src': hashAndPolicyList }
}
