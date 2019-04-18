import path from 'path'
import crypto from 'crypto'
import fs from 'fs-extra'
import devalue from '@nuxt/devalue'
import { createBundleRenderer } from 'vue-server-renderer'

import Renderer from '../index'

export default class SSRRenderer extends Renderer {
  get rendererOptions() {
    const hasModules = fs.existsSync(path.resolve(this.context.options.rootDir, 'node_modules'))

    return {
      clientManifest: this.context.resources.clientManifest,
      // for globally installed nuxt command, search dependencies in global dir
      basedir: hasModules ? this.context.options.rootDir : __dirname,
      ...this.context.options.render.bundleRenderer
    }
  }

  renderScripts(context) {
    return context.renderScripts()
  }

  getPreloadFiles(context) {
    return context.getPreloadFiles()
  }

  renderResourceHints(context) {
    return context.renderResourceHints()
  }

  createRenderer() {
    // Create bundle renderer for SSR
    return createBundleRenderer(
      this.context.resources.serverManifest,
      this.rendererOptions
    )
  }

  async render(context) {
    // Call ssr:context hook to extend context from modules
    await this.context.nuxt.callHook('vue-renderer:ssr:prepareContext', context)

    // Call Vue renderer renderToString
    let APP = await this.vueRenderer.renderToString(context)

    // Call ssr:context hook
    await this.context.nuxt.callHook('vue-renderer:ssr:context', context)
    // TODO: Remove in next major release
    await this.context.nuxt.callHook('render:routeContext', context.nuxt)

    // Fallback to empty response
    if (!context.nuxt.serverRendered) {
      APP = `<div id="${this.context.globals.id}"></div>`
    }

    // Inject head meta
    const m = context.meta.inject()
    let HEAD =
      m.title.text() +
      m.meta.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()

    // Add <base href=""> meta if router base specified
    if (this.context.options._routerBaseSpecified) {
      HEAD += `<base href="${this.context.options.router.base}">`
    }

    // Inject resource hints
    if (this.context.options.render.resourceHints) {
      HEAD += this.renderResourceHints(context)
    }

    // Inject styles
    HEAD += context.renderStyles()

    // Serialize state
    const serializedSession = `window.${this.context.globals.context}=${devalue(context.nuxt)};`
    APP += `<script>${serializedSession}</script>`

    // Calculate CSP hashes
    const { csp } = this.context.options.render
    const cspScriptSrcHashes = []
    if (csp) {
      // Only add the hash if 'unsafe-inline' rule isn't present to avoid conflicts (#5387)
      const containsUnsafeInlineScriptSrc = csp.policies && csp.policies['script-src'] && csp.policies['script-src'].includes(`'unsafe-inline'`)
      if (!containsUnsafeInlineScriptSrc) {
        const hash = crypto.createHash(csp.hashAlgorithm)
        hash.update(serializedSession)
        cspScriptSrcHashes.push(`'${csp.hashAlgorithm}-${hash.digest('base64')}'`)
      }

      // Call ssr:csp hook
      await this.context.nuxt.callHook('vue-renderer:ssr:csp', cspScriptSrcHashes)

      // Add csp meta tags
      if (csp.addMeta) {
        HEAD += `<meta http-equiv="Content-Security-Policy" content="script-src ${cspScriptSrcHashes.join()}">`
      }
    }

    // Prepend scripts
    APP += this.renderScripts(context)
    APP += m.script.text({ body: true })
    APP += m.noscript.text({ body: true })

    // Template params
    const templateParams = {
      HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
      HEAD_ATTRS: m.headAttrs.text(),
      BODY_ATTRS: m.bodyAttrs.text(),
      HEAD,
      APP,
      ENV: this.context.options.env
    }

    // Call ssr:templateParams hook
    await this.context.nuxt.callHook('vue-renderer:ssr:templateParams', templateParams)

    // Render with SSR template
    const html = this.renderTemplate(this.context.resources.ssrTemplate, templateParams)

    let preloadFiles
    if (this.context.options.render.http2.push) {
      preloadFiles = this.getPreloadFiles(context)
    }

    return {
      html,
      cspScriptSrcHashes,
      preloadFiles,
      error: context.nuxt.error,
      redirected: context.redirected
    }
  }
}
