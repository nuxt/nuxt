import path from 'path'
import crypto from 'crypto'
import { format } from 'util'
import fs from 'fs-extra'
import consola from 'consola'
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
    return renderContext.renderScripts()
  }

  getPreloadFiles (renderContext) {
    return renderContext.getPreloadFiles()
  }

  renderResourceHints (renderContext) {
    return renderContext.renderResourceHints()
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
    // TODO: Remove in next major release
    await this.serverContext.nuxt.callHook('render:routeContext', renderContext.nuxt)

    // Fallback to empty response
    if (!renderContext.nuxt.serverRendered) {
      APP = `<div id="${this.serverContext.globals.id}"></div>`
    }

    // Inject head meta
    const m = renderContext.meta.inject()
    let HEAD =
      m.title.text() +
      m.meta.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()

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

    // Serialize state
    const serializedSession = `window.${this.serverContext.globals.context}=${devalue(renderContext.nuxt)};`
    if (shouldInjectScripts) {
      APP += `<script>${serializedSession}</script>`
    }

    // Calculate CSP hashes
    const { csp } = this.options.render
    const cspScriptSrcHashes = []
    if (csp) {
      // Only add the hash if 'unsafe-inline' rule isn't present to avoid conflicts (#5387)
      const containsUnsafeInlineScriptSrc = csp.policies && csp.policies['script-src'] && csp.policies['script-src'].includes(`'unsafe-inline'`)
      if (csp.unsafeInlineCompatiblity || !containsUnsafeInlineScriptSrc) {
        const hash = crypto.createHash(csp.hashAlgorithm)
        hash.update(serializedSession)
        cspScriptSrcHashes.push(`'${csp.hashAlgorithm}-${hash.digest('base64')}'`)
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
    APP += m.script.text({ body: true })
    APP += m.noscript.text({ body: true })

    // Template params
    const templateParams = {
      HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
      HEAD_ATTRS: m.headAttrs.text(),
      BODY_ATTRS: m.bodyAttrs.text(),
      HEAD,
      APP,
      ENV: this.options.env
    }

    // Call ssr:templateParams hook
    await this.serverContext.nuxt.callHook('vue-renderer:ssr:templateParams', templateParams)

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
