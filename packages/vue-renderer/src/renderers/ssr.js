import path from 'path'
import crypto from 'crypto'
import { format } from 'util'
import fs from 'fs-extra'
import consola from 'consola'
import { TARGETS, urlJoin } from '@nuxt/utils'
import devalue from '@nuxt/devalue'
import { createBundleRenderer } from 'vue-server-renderer'
import BaseRenderer from './base'

export default class SSRRenderer extends BaseRenderer {
  get rendererOptions () {
    const hasModules = fs.existsSync(path.resolve(this.options.rootDir, 'node_modules'))

    return {
      clientManifest: this.serverContext.resources.clientManifest,
      // for globally installed nuxt command, search dependencies in global dir
      basedir: hasModules ? this.options.rootDir : __dirname,
      ...this.options.render.bundleRenderer
    }
  }

  renderScripts (renderContext) {
    const scripts = renderContext.renderScripts()
    const { render: { crossorigin } } = this.options
    if (!crossorigin) {
      return scripts
    }
    return scripts.replace(
      /<script/g,
      `<script crossorigin="${crossorigin}"`
    )
  }

  getPreloadFiles (renderContext) {
    return renderContext.getPreloadFiles()
  }

  renderResourceHints (renderContext) {
    const resourceHints = renderContext.renderResourceHints()
    const { render: { crossorigin } } = this.options
    if (!crossorigin) {
      return resourceHints
    }
    return resourceHints.replace(
      /rel="preload"/g,
      `rel="preload" crossorigin="${crossorigin}"`
    )
  }

  createRenderer () {
    // Create bundle renderer for SSR
    return createBundleRenderer(
      this.serverContext.resources.serverManifest,
      this.rendererOptions
    )
  }

  useSSRLog () {
    if (!this.options.render.ssrLog) {
      return
    }
    const logs = []
    const devReporter = {
      log (logObj) {
        logs.push({
          ...logObj,
          args: logObj.args.map(arg => format(arg))
        })
      }
    }
    consola.addReporter(devReporter)

    return () => {
      consola.removeReporter(devReporter)
      return logs
    }
  }

  async render (renderContext) {
    // Call ssr:context hook to extend context from modules
    await this.serverContext.nuxt.callHook('vue-renderer:ssr:prepareContext', renderContext)

    const getSSRLog = this.useSSRLog()

    // Call Vue renderer renderToString
    let APP = await this.vueRenderer.renderToString(renderContext)

    if (typeof getSSRLog === 'function') {
      renderContext.nuxt.logs = getSSRLog()
    }

    // Call ssr:context hook
    await this.serverContext.nuxt.callHook('vue-renderer:ssr:context', renderContext)

    // TODO: Remove in next major release (#4722)
    await this.serverContext.nuxt.callHook('_render:context', renderContext.nuxt)

    // Fallback to empty response
    if (!renderContext.nuxt.serverRendered) {
      APP = `<div id="${this.serverContext.globals.id}"></div>`
    }

    // Perf: early returns if server target and redirected
    if (renderContext.redirected && renderContext.target === TARGETS.server) {
      return {
        html: APP,
        error: renderContext.nuxt.error,
        redirected: renderContext.redirected
      }
    }

    let HEAD = ''

    // Inject head meta
    // (this is unset when features.meta is false in server template)
    const meta = renderContext.meta && renderContext.meta.inject()
    if (meta) {
      HEAD += meta.title.text() +
        meta.meta.text() +
        meta.link.text() +
        meta.style.text() +
        meta.script.text() +
        meta.noscript.text()
    }

    // Check if we need to inject scripts and state
    const shouldInjectScripts = this.options.render.injectScripts !== false

    // Add <base href=""> meta if router base specified
    if (this.options._routerBaseSpecified) {
      HEAD += `<base href="${this.options.router.base}">`
    }

    // Inject resource hints
    if (this.options.render.resourceHints && shouldInjectScripts) {
      HEAD += this.renderResourceHints(renderContext)
    }

    // Inject styles
    HEAD += renderContext.renderStyles()

    if (meta) {
      const BODY_PREPEND =
        meta.meta.text({ pbody: true }) +
        meta.link.text({ pbody: true }) +
        meta.style.text({ pbody: true }) +
        meta.script.text({ pbody: true }) +
        meta.noscript.text({ pbody: true })

      if (BODY_PREPEND) {
        APP = `${BODY_PREPEND}${APP}`
      }
    }

    const { csp } = this.options.render
    // Only add the hash if 'unsafe-inline' rule isn't present to avoid conflicts (#5387)
    const containsUnsafeInlineScriptSrc = csp.policies && csp.policies['script-src'] && csp.policies['script-src'].includes('\'unsafe-inline\'')
    const shouldHashCspScriptSrc = csp && (csp.unsafeInlineCompatibility || !containsUnsafeInlineScriptSrc)
    const inlineScripts = []

    if (renderContext.staticAssetsBase) {
      const preloadScripts = []
      renderContext.staticAssets = []
      const { staticAssetsBase, url, nuxt, staticAssets } = renderContext
      const { data, fetch, mutations, ...state } = nuxt

      // Initial state
      const nuxtStaticScript = `window.__NUXT_STATIC__='${staticAssetsBase}';`
      const stateScript = `window.${this.serverContext.globals.context}=${devalue(state)};`

      // Make chunk for initial state > 10 KB
      const stateScriptKb = (stateScript.length * 4 /* utf8 */) / 100
      if (stateScriptKb > 10) {
        const statePath = urlJoin(url, 'state.js')
        const stateUrl = urlJoin(staticAssetsBase, statePath)
        staticAssets.push({ path: statePath, src: stateScript })
        APP += `<script defer>${nuxtStaticScript}</script>`
        APP += `<script defer src="${staticAssetsBase}${statePath}"></script>`
        preloadScripts.push(stateUrl)
      } else {
        APP += `<script defer>${nuxtStaticScript}${stateScript}</script>`
      }

      // Page level payload.js (async loaded for CSR)
      const payloadPath = urlJoin(url, 'payload.js')
      const payloadUrl = urlJoin(staticAssetsBase, payloadPath)
      const routePath = (url.replace(/\/+$/, '') || '/').split('?')[0] // remove trailing slah and query params
      const payloadScript = `__NUXT_JSONP__("${routePath}", ${devalue({ data, fetch, mutations })});`
      staticAssets.push({ path: payloadPath, src: payloadScript })
      preloadScripts.push(payloadUrl)

      // Preload links
      for (const href of preloadScripts) {
        HEAD += `<link rel="preload" href="${href}" as="script">`
      }
    } else {
      // Serialize state
      let serializedSession
      if (shouldInjectScripts || shouldHashCspScriptSrc) {
        // Only serialized session if need inject scripts or csp hash
        serializedSession = `window.${this.serverContext.globals.context}=${devalue(renderContext.nuxt)};`
        inlineScripts.push(serializedSession)
      }

      if (shouldInjectScripts) {
        APP += `<script>${serializedSession}</script>`
      }
    }

    // Calculate CSP hashes
    const cspScriptSrcHashes = []
    if (csp) {
      if (shouldHashCspScriptSrc) {
        for (const script of inlineScripts) {
          const hash = crypto.createHash(csp.hashAlgorithm)
          hash.update(script)
          cspScriptSrcHashes.push(`'${csp.hashAlgorithm}-${hash.digest('base64')}'`)
        }
      }

      // Call ssr:csp hook
      await this.serverContext.nuxt.callHook('vue-renderer:ssr:csp', cspScriptSrcHashes)

      // Add csp meta tags
      if (csp.addMeta) {
        HEAD += `<meta http-equiv="Content-Security-Policy" content="script-src ${cspScriptSrcHashes.join()}">`
      }
    }

    // Prepend scripts
    if (shouldInjectScripts) {
      APP += this.renderScripts(renderContext)
    }

    if (meta) {
      // Append body scripts
      APP += meta.meta.text({ body: true })
      APP += meta.link.text({ body: true })
      APP += meta.style.text({ body: true })
      APP += meta.script.text({ body: true })
      APP += meta.noscript.text({ body: true })
    }

    // Template params
    const templateParams = {
      HTML_ATTRS: meta ? meta.htmlAttrs.text(true /* addSrrAttribute */) : '',
      HEAD_ATTRS: meta ? meta.headAttrs.text() : '',
      BODY_ATTRS: meta ? meta.bodyAttrs.text() : '',
      HEAD,
      APP,
      ENV: this.options.env
    }

    // Call ssr:templateParams hook
    await this.serverContext.nuxt.callHook('vue-renderer:ssr:templateParams', templateParams, renderContext)

    // Render with SSR template
    const html = this.renderTemplate(this.serverContext.resources.ssrTemplate, templateParams)

    let preloadFiles
    if (this.options.render.http2.push) {
      preloadFiles = this.getPreloadFiles(renderContext)
    }

    return {
      html,
      cspScriptSrcHashes,
      preloadFiles,
      error: renderContext.nuxt.error,
      redirected: renderContext.redirected
    }
  }
}
