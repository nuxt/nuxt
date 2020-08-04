import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'
import template from 'lodash/template'
import { TARGETS, isModernRequest, waitFor } from 'src/utils'

import SPARenderer from './renderers/spa'
import SSRRenderer from './renderers/ssr'
import ModernRenderer from './renderers/modern'
import ServerContext from 'src/server/context'

export default class VueRenderer {
  __closed?: boolean
  _state?: 'created' | 'loading' | 'ready' | 'error'
  _error?: null
  _readyPromise?: Promise<any>
  distPath: string
  serverContext: ServerContext
  renderer: {
    ssr: any
    modern: any
    spa: any
  }

  constructor (context: ServerContext) {
    this.serverContext = context
    this.options = this.serverContext.options

    // Will be set by createRenderer
    this.renderer = {
      ssr: undefined,
      modern: undefined,
      spa: undefined
    }

    // Renderer runtime resources
    Object.assign(this.serverContext.resources, {
      clientManifest: undefined,
      modernManifest: undefined,
      serverManifest: undefined,
      ssrTemplate: undefined,
      spaTemplate: undefined,
      errorTemplate: this.parseTemplate('Nuxt.js Internal Server Error')
    })

    // Default status
    this._state = 'created'
    this._error = null
  }

  ready () {
    if (!this._readyPromise) {
      this._state = 'loading'
      this._readyPromise = this._ready()
        .then(() => {
          this._state = 'ready'
          return this
        })
        .catch((error) => {
          this._state = 'error'
          this._error = error
          throw error
        })
    }

    return this._readyPromise
  }

  async _ready () {
    // Resolve dist path
    this.distPath = path.resolve(this.options.buildDir, 'dist', 'server')

    // -- Development mode --
    if (this.options.dev) {
      this.serverContext.nuxt.hook('build:resources', mfs => this.loadResources(mfs))
      return
    }

    // -- Production mode --

    // Try once to load SSR resources from fs
    await this.loadResources(fs)

    // Without using `nuxt start` (programmatic, tests and generate)
    if (!this.options._start) {
      this.serverContext.nuxt.hook('build:resources', () => this.loadResources(fs))
      return
    }

    // Verify resources
    if (this.options.modern && !this.isModernReady) {
      throw new Error(
        `No modern build files found in ${this.distPath}.\nUse either \`nuxt build --modern\` or \`modern\` option to build modern files.`
      )
    } else if (!this.isReady) {
      throw new Error(
        `No build files found in ${this.distPath}.\nUse either \`nuxt build\` or \`builder.build()\` or start nuxt in development mode.`
      )
    }
  }

  async loadResources (_fs: typeof import('fs-extra')) {
    const updated = []

    const readResource = async (fileName: string, encoding: string) => {
      try {
        const fullPath = path.resolve(this.distPath, fileName)

        if (!await _fs.exists(fullPath)) {
          return
        }
        const contents = await _fs.readFile(fullPath, encoding)

        return contents
      } catch (err) {
        consola.error('Unable to load resource:', fileName, err)
      }
    }

    for (const resourceName in this.resourceMap) {
      const { fileName, transform, encoding } = this.resourceMap[resourceName]

      // Load resource
      let resource = await readResource(fileName, encoding)

      // Skip unavailable resources
      if (!resource) {
        continue
      }

      // Apply transforms
      if (typeof transform === 'function') {
        resource = await transform(resource, { readResource })
      }

      // Update resource
      this.serverContext.resources[resourceName] = resource
      updated.push(resourceName)
    }

    // Load templates
    await this.loadTemplates()

    await this.serverContext.nuxt.callHook('render:resourcesLoaded', this.serverContext.resources)

    // Detect if any resource updated
    if (updated.length > 0) {
      // Create new renderer
      this.createRenderer()
    }
  }

  async loadTemplates () {
    // Reload error template
    const errorTemplatePath = path.resolve(this.options.buildDir, 'views/error.html')

    if (await fs.exists(errorTemplatePath)) {
      const errorTemplate = await fs.readFile(errorTemplatePath, 'utf8')
      this.serverContext.resources.errorTemplate = this.parseTemplate(errorTemplate)
    }

    // Reload loading template
    const loadingHTMLPath = path.resolve(this.options.buildDir, 'loading.html')

    if (await fs.exists(loadingHTMLPath)) {
      this.serverContext.resources.loadingHTML = await fs.readFile(loadingHTMLPath, 'utf8')
      this.serverContext.resources.loadingHTML = this.serverContext.resources.loadingHTML.replace(/\r|\n|[\t\s]{3,}/g, '')
    } else {
      this.serverContext.resources.loadingHTML = ''
    }
  }

  // TODO: Remove in Nuxt 3
  get noSSR () { /* Backward compatibility */
    return this.options.render.ssr === false
  }

  get SSR () {
    return this.options.render.ssr === true
  }

  get isReady () {
    // SPA
    if (!this.serverContext.resources.spaTemplate || !this.renderer.spa) {
      return false
    }

    // SSR
    if (this.SSR && (!this.serverContext.resources.ssrTemplate || !this.renderer.ssr)) {
      return false
    }

    return true
  }

  get isModernReady () {
    return this.isReady && this.serverContext.resources.modernManifest
  }

  // TODO: Remove in Nuxt 3
  get isResourcesAvailable () { /* Backward compatibility */
    return this.isReady
  }

  detectModernBuild () {
    const { options, resources } = this.serverContext
    if ([false, 'client', 'server'].includes(options.modern)) {
      return
    }

    const isExplicitStaticModern = options.target === TARGETS.static && options.modern
    if (!resources.modernManifest && !isExplicitStaticModern) {
      options.modern = false
      return
    }

    options.modern = options.render.ssr ? 'server' : 'client'
    consola.info(`Modern bundles are detected. Modern mode (\`${options.modern}\`) is enabled now.`)
  }

  createRenderer () {
    // Resource clientManifest is always required
    if (!this.serverContext.resources.clientManifest) {
      return
    }

    this.detectModernBuild()

    // Create SPA renderer
    if (this.serverContext.resources.spaTemplate) {
      this.renderer.spa = new SPARenderer(this.serverContext)
    }

    // Skip the rest if SSR resources are not available
    if (this.serverContext.resources.ssrTemplate && this.serverContext.resources.serverManifest) {
      // Create bundle renderer for SSR
      this.renderer.ssr = new SSRRenderer(this.serverContext)

      if (this.options.modern !== false) {
        this.renderer.modern = new ModernRenderer(this.serverContext)
      }
    }
  }

  renderSPA (renderContext) {
    return this.renderer.spa.render(renderContext)
  }

  renderSSR (renderContext) {
    // Call renderToString from the bundleRenderer and generate the HTML (will update the renderContext as well)
    const renderer = renderContext.modern ? this.renderer.modern : this.renderer.ssr
    return renderer.render(renderContext)
  }

  async renderRoute (url, renderContext = {}, _retried = 0) {
    /* istanbul ignore if */
    if (!this.isReady) {
      // Fall-back to loading-screen if enabled
      if (this.options.build.loadingScreen) {
        // Tell nuxt middleware to use `server:nuxt:renderLoading hook
        return false
      }

      // Retry
      const retryLimit = this.options.dev ? 60 : 3
      if (_retried < retryLimit && this._state !== 'error') {
        await this.ready().then(() => waitFor(1000))
        return this.renderRoute(url, renderContext, _retried + 1)
      }

      // Throw Error
      switch (this._state) {
        case 'created':
          throw new Error('Renderer ready() is not called! Please ensure `nuxt.ready()` is called and awaited.')
        case 'loading':
          throw new Error('Renderer is loading.')
        case 'error':
          throw this._error
        case 'ready':
          throw new Error(`Renderer resources are not loaded! Please check possible console errors and ensure dist (${this.distPath}) exists.`)
        default:
          throw new Error('Renderer is in unknown state!')
      }
    }

    // Log rendered url
    consola.debug(`Rendering url ${url}`)

    // Add url to the renderContext
    renderContext.url = url
    // Add target to the renderContext
    renderContext.target = this.serverContext.nuxt.options.target

    const { req = {}, res = {} } = renderContext

    // renderContext.spa
    if (renderContext.spa === undefined) {
      // TODO: Remove reading from renderContext.res in Nuxt3
      renderContext.spa = !this.SSR || req.spa || res.spa
    }

    // renderContext.modern
    if (renderContext.modern === undefined) {
      const modernMode = this.options.modern
      renderContext.modern = modernMode === 'client' || isModernRequest(req, modernMode)
    }

    // Set runtime config on renderContext
    renderContext.runtimeConfig = {
      private: renderContext.spa ? {} : { ...this.options.privateRuntimeConfig },
      public: { ...this.options.publicRuntimeConfig }
    }

    // Call renderContext hook
    await this.serverContext.nuxt.callHook('vue-renderer:context', renderContext)

    // Render SPA or SSR
    return renderContext.spa
      ? this.renderSPA(renderContext)
      : this.renderSSR(renderContext)
  }

  get resourceMap () {
    return {
      clientManifest: {
        fileName: 'client.manifest.json',
        transform: (src: string) => JSON.parse(src)
      },
      modernManifest: {
        fileName: 'modern.manifest.json',
        transform: (src: string) => JSON.parse(src)
      },
      serverManifest: {
        fileName: 'server.manifest.json',
        // BundleRenderer needs resolved contents
        transform: async (src: string, { readResource }) => {
          const serverManifest = JSON.parse(src)

          const readResources = async (obj) => {
            const _obj = {}
            await Promise.all(Object.keys(obj).map(async (key) => {
              _obj[key] = await readResource(obj[key])
            }))
            return _obj
          }

          const [files, maps] = await Promise.all([
            readResources(serverManifest.files),
            readResources(serverManifest.maps)
          ])

          // Try to parse sourcemaps
          for (const map in maps) {
            if (maps[map] && maps[map].version) {
              continue
            }
            try {
              maps[map] = JSON.parse(maps[map])
            } catch (e) {
              maps[map] = { version: 3, sources: [], mappings: '' }
            }
          }

          return {
            ...serverManifest,
            files,
            maps
          }
        }
      },
      ssrTemplate: {
        fileName: 'index.ssr.html',
        transform: (src: string) => this.parseTemplate(src)
      },
      spaTemplate: {
        fileName: 'index.spa.html',
        transform: (src: string) => this.parseTemplate(src)
      }
    }
  }

  parseTemplate (templateStr: string) {
    return template(templateStr, {
      interpolate: /{{([\s\S]+?)}}/g,
      evaluate: /{%([\s\S]+?)%}/g
    })
  }

  close () {
    if (this.__closed) {
      return
    }
    this.__closed = true

    for (const key in this.renderer) {
      delete this.renderer[key]
    }
  }
}
