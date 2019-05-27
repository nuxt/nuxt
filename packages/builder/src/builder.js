import path from 'path'
import chokidar from 'chokidar'
import consola from 'consola'
import fsExtra from 'fs-extra'
import Glob from 'glob'
import hash from 'hash-sum'
import pify from 'pify'
import upath from 'upath'
import semver from 'semver'

import debounce from 'lodash/debounce'
import omit from 'lodash/omit'
import template from 'lodash/template'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'

import {
  r,
  createRoutes,
  relativeTo,
  waitFor,
  determineGlobals,
  stripWhitespace,
  isString,
  isIndexFileAndFolder,
  isPureObject,
  clearRequireCache
} from '@nuxt/utils'

import Ignore from './ignore'
import BuildContext from './context/build'
import TemplateContext from './context/template'

const glob = pify(Glob)
export default class Builder {
  constructor(nuxt, bundleBuilder) {
    this.nuxt = nuxt
    this.plugins = []
    this.options = nuxt.options
    this.globals = determineGlobals(nuxt.options.globalName, nuxt.options.globals)
    this.watchers = {
      files: null,
      custom: null,
      restart: null
    }

    this.supportedExtensions = ['vue', 'js', 'ts', 'tsx']

    // Helper to resolve build paths
    this.relativeToBuild = (...args) => relativeTo(this.options.buildDir, ...args)

    this._buildStatus = STATUS.INITIAL

    // Hooks for watch lifecycle
    if (this.options.dev) {
      // Start watching after initial render
      this.nuxt.hook('build:done', () => {
        consola.info('Waiting for file changes')
        this.watchClient()
        this.watchRestart()
      })

      // Close hook
      this.nuxt.hook('close', () => this.close())
    }

    if (this.options.build.analyze) {
      this.nuxt.hook('build:done', () => {
        consola.warn('Notice: Please do not deploy bundles built with analyze mode, it\'s only for analyzing purpose.')
      })
    }

    // Resolve template
    this.template = this.options.build.template || '@nuxt/vue-app'
    if (typeof this.template === 'string') {
      this.template = this.nuxt.resolver.requireModule(this.template).template
    }

    // Create a new bundle builder
    this.bundleBuilder = this.getBundleBuilder(bundleBuilder)

    this.ignore = new Ignore({
      rootDir: this.options.srcDir
    })

    // Resolve apps
    this.resolveApps()
  }

  getBundleBuilder(BundleBuilder) {
    if (typeof BundleBuilder === 'object') {
      return BundleBuilder
    }

    const context = new BuildContext(this)

    if (typeof BundleBuilder !== 'function') {
      ({ BundleBuilder } = require('@nuxt/webpack'))
    }

    return new BundleBuilder(context)
  }

  forGenerate() {
    this.bundleBuilder.forGenerate()
  }

  async build() {
    // Avoid calling build() method multiple times when dev:true
    if (this._buildStatus === STATUS.BUILD_DONE && this.options.dev) {
      return this
    }
    // If building
    if (this._buildStatus === STATUS.BUILDING) {
      await waitFor(1000)
      return this.build()
    }
    this._buildStatus = STATUS.BUILDING

    if (this.options.dev) {
      consola.info('Preparing project for development')
      consola.info('Initial build may take a while')
    } else {
      consola.info('Production build')
    }

    // Wait for nuxt ready
    await this.nuxt.ready()

    // Call before hook
    await this.nuxt.callHook('build:before', this, this.options.build)

    await this.validatePages()

    // Validate template
    try {
      this.validateTemplate()
    } catch (err) {
      consola.fatal(err)
    }

    consola.success('Builder initialized')

    consola.debug(`App root: ${this.options.srcDir}`)

    // Create .nuxt/, .nuxt/components and .nuxt/dist folders
    await fsExtra.remove(r(this.options.buildDir))
    const buildDirs = [r(this.options.buildDir, 'components')]
    if (!this.options.dev) {
      buildDirs.push(
        r(this.options.buildDir, 'dist', 'client'),
        r(this.options.buildDir, 'dist', 'server')
      )
    }
    await Promise.all(buildDirs.map(dir => fsExtra.mkdirp(dir)))

    // Generate routes and interpret the template files
    await this.generateRoutesAndFiles()

    await this.resolvePlugins()

    // Start bundle build: webpack, rollup, parcel...
    await this.bundleBuilder.build()

    // Flag to set that building is done
    this._buildStatus = STATUS.BUILD_DONE

    // Call done hook
    await this.nuxt.callHook('build:done', this)

    return this
  }

  // Check if pages dir exists and warn if not
  async validatePages() {
    this._nuxtPages = typeof this.options.build.createRoutes !== 'function'

    if (
      !this._nuxtPages ||
      await fsExtra.exists(path.join(this.options.srcDir, this.options.dir.pages))
    ) {
      return
    }

    const dir = this.options.srcDir
    if (await fsExtra.exists(path.join(this.options.srcDir, '..', this.options.dir.pages))) {
      throw new Error(
        `No \`${this.options.dir.pages}\` directory found in ${dir}. Did you mean to run \`nuxt\` in the parent (\`../\`) directory?`
      )
    }

    this._defaultPage = true
    consola.warn(`No \`${this.options.dir.pages}\` directory found in ${dir}. Using the default built-in page.`)
  }

  validateTemplate() {
    // Validate template dependencies
    const templateDependencies = this.template.dependencies
    for (const depName in templateDependencies) {
      const depVersion = templateDependencies[depName]

      // Load installed version
      const pkg = this.nuxt.resolver.requireModule(path.join(depName, 'package.json'))
      if (pkg) {
        const validVersion = semver.satisfies(pkg.version, depVersion)
        if (!validVersion) {
          consola.warn(`${depName}@${depVersion} is recommended but ${depName}@${pkg.version} is installed!`)
        }
      } else {
        consola.warn(`${depName}@${depVersion} is required but not installed!`)
      }
    }
  }

  globPathWithExtensions(path) {
    return `${path}/**/*.{${this.supportedExtensions.join(',')}}`
  }

  async generateRoutesAndFiles() {
    consola.debug('Generating nuxt files')

    // Plugins
    this.plugins = Array.from(this.normalizePlugins())

    const templateContext = new TemplateContext(this, this.options)

    for (const app of this.apps) {
      await Promise.all([
        this.resolveLayouts(templateContext, app),
        this.resolveRoutes(templateContext, app, app._isMain),
        (app._isMain && app.store) && this.resolveStore(templateContext, app),
        (app._isMain) && this.resolveMiddleware(templateContext, app)
      ])
    }

    await this.resolveCustomTemplates(templateContext)

    await this.resolveLoadingIndicator(templateContext)

    // Add vue-app template dir to watchers
    this.options.build.watch.push(this.globPathWithExtensions(this.template.dir))

    await this.compileTemplates(templateContext)

    consola.success('Nuxt files generated')
  }

  resolveApps() {
    // Main app
    const mainApp = {
      name: 'main',
      _isMain: true,
      store: this.options.store,
      dir: undefined,
      srcDir: this.options.srcDir
    }

    // Resolve apps
    this.apps = [...this.options.apps, mainApp].map((app) => {
      // String mode
      if (typeof app === 'string') {
        app = { srcDir: app }
      }

      // Resolve srcDir relative to rootDir if not absolute
      app.srcDir = this.nuxt.resolver.resolvePath(app.srcDir)

      // Inherit project dirs
      app.dir = { ...this.options.dir, ...app.dir }

      // Assign a name
      if (!app.name) {
        app.name = path.basename(app.srcDir)
      }

      // Detect store
      if (app.store === undefined) {
        app.store = fsExtra.existsSync(path.resolve(app.srcDir, app.dir.store))
      }

      return app
    })

    // Add aliases
    for (const app of this.apps) {
      const alias = '~' + app.name
      if (!this.options.alias[alias]) {
        this.options.alias[alias] = app.srcDir
      }
    }
  }

  normalizePlugins() {
    const modes = ['client', 'server']
    const modePattern = new RegExp(`\\.(${modes.join('|')})(\\.\\w+)*$`)
    return uniqBy(
      this.options.plugins.map((p) => {
        if (typeof p === 'string') {
          p = { src: p }
        }
        const pluginBaseName = path.basename(p.src, path.extname(p.src)).replace(
          /[^a-zA-Z?\d\s:]/g,
          ''
        )

        if (p.ssr === false) {
          p.mode = 'client'
        } else if (p.mode === undefined) {
          p.mode = 'all'
          p.src.replace(modePattern, (_, mode) => {
            if (modes.includes(mode)) {
              p.mode = mode
            }
          })
        } else if (!['client', 'server', 'all'].includes(p.mode)) {
          consola.warn(`Invalid plugin mode (server/client/all): '${p.mode}'. Falling back to 'all'`)
          p.mode = 'all'
        }

        return {
          src: this.nuxt.resolver.resolveAlias(p.src),
          mode: p.mode,
          name: 'nuxt_plugin_' + pluginBaseName + '_' + hash(p.src)
        }
      }),
      p => p.name
    )
  }

  async resolveFiles(dir, cwd = this.options.srcDir) {
    return this.ignore.filter(await glob(this.globPathWithExtensions(dir), {
      cwd,
      ignore: this.options.ignore
    }))
  }

  async resolveRelative(dir, cwd = this.options.srcDir) {
    const dirPrefix = new RegExp(`^${dir}/`)
    return (await this.resolveFiles(dir, cwd)).map(file => ({ src: file.replace(dirPrefix, '') }))
  }

  async resolveLayouts({ templateVars, templateFiles }, { srcDir, dir }) {
    if (await fsExtra.exists(path.resolve(srcDir, dir.layouts))) {
      for (const file of await this.resolveFiles(dir.layouts, srcDir)) {
        const name = file
          .replace(new RegExp(`^${dir.layouts}/`), '')
          .replace(new RegExp(`\\.(${this.supportedExtensions.join('|')})$`), '')

        // Layout Priority: module.addLayout > .vue file > other extensions
        if (name === 'error') {
          if (!templateVars.components.ErrorPage) {
            templateVars.components.ErrorPage = this.relativeToBuild(
              srcDir,
              file
            )
          }
        } else if (this.options.layouts[name]) {
          consola.warn(`Duplicate layout registration, "${name}" has been registered as "${this.options.layouts[name]}"`)
        } else if (!templateVars.layouts[name] || /\.vue$/.test(file)) {
          templateVars.layouts[name] = this.relativeToBuild(
            srcDir,
            file
          )
        }
      }
    }

    // If no default layout, create its folder and add the default folder
    if (!templateVars.layouts.default) {
      await fsExtra.mkdirp(r(this.options.buildDir, 'layouts'))
      templateFiles.push('layouts/default.vue')
      templateVars.layouts.default = './layouts/default.vue'
    }
  }

  async resolveRoutes({ templateVars }, { srcDir, dir }, extendRoutes = false) {
    consola.debug('Generating routes...')

    if (this._defaultPage) {
      templateVars.router.routes.push(...createRoutes(
        ['index.vue'],
        this.template.dir + '/pages',
        '',
        this.options.router.routeNameSplitter
      ))
    } else if (this._nuxtPages) {
      // Use nuxt.js createRoutes bases on pages/
      const files = {}
      const ext = new RegExp(`\\.(${this.supportedExtensions.join('|')})$`)
      for (const page of await this.resolveFiles(dir.pages, srcDir)) {
        const key = page.replace(ext, '')
        // .vue file takes precedence over other extensions
        if (/\.vue$/.test(page) || !files[key]) {
          files[key] = page.replace(/(['"])/g, '\\$1')
        }
      }
      templateVars.router.routes.push(...createRoutes(
        Object.values(files),
        srcDir,
        dir.pages,
        this.options.router.routeNameSplitter
      ))
    } else { // If user defined a custom method to create routes
      templateVars.router.routes.push(...this.options.build.createRoutes(
        srcDir
      ))
    }

    if (extendRoutes) {
      await this.nuxt.callHook(
        'build:extendRoutes',
        templateVars.router.routes,
        r
      )
      // router.extendRoutes method
      if (typeof this.options.router.extendRoutes === 'function') {
        // let the user extend the routes
        const extendedRoutes = this.options.router.extendRoutes(
          templateVars.router.routes,
          r
        )
        // Only overwrite routes when something is returned for backwards compatibility
        if (extendedRoutes !== undefined) {
          templateVars.router.routes = extendedRoutes
        }
      }
    }

    // Make routes accessible for other modules and webpack configs
    this.routes = templateVars.router.routes
  }

  async resolveStore({ templateVars, templateFiles }, { srcDir, dir }) {
    templateVars.storeModules.push(...(await this.resolveRelative(dir.store, srcDir))
      .sort(({ src: p1 }, { src: p2 }) => {
        // modules are sorted from low to high priority (for overwriting properties)
        let res = p1.split('/').length - p2.split('/').length
        if (res === 0 && p1.includes('/index.')) {
          res = -1
        } else if (res === 0 && p2.includes('/index.')) {
          res = 1
        }
        return res
      }))

    if (!templateFiles.includes('store.js')) {
      templateFiles.push('store.js')
    }
  }

  async resolveMiddleware({ templateVars }, { srcDir, dir }) {
    // -- Middleware --
    templateVars.middleware.push(...await this.resolveRelative(dir.middleware, srcDir))
  }

  async resolveCustomTemplates(templateContext) {
    // Resolve template files
    const customTemplateFiles = this.options.build.templates.map(
      t => t.dst || path.basename(t.src || t)
    )

    const templateFiles = await Promise.all(templateContext.templateFiles.map(async (file) => {
      // Skip if custom file was already provided in build.templates[]
      if (customTemplateFiles.includes(file)) {
        return
      }
      // Allow override templates using a file with same name in ${srcDir}/app
      const customPath = r(this.options.srcDir, 'app', file)
      const customFileExists = await fsExtra.exists(customPath)

      return {
        src: customFileExists ? customPath : r(this.template.dir, file),
        dst: file,
        custom: customFileExists
      }
    }))

    templateContext.templateFiles = templateFiles
      .filter(Boolean)
      // Add custom template files
      .concat(
        this.options.build.templates.map((t) => {
          return Object.assign(
            {
              src: r(this.options.srcDir, t.src || t),
              dst: t.dst || path.basename(t.src || t),
              custom: true
            },
            typeof t === 'object' ? t : undefined
          )
        })
      )
  }

  async resolveLoadingIndicator({ templateFiles }) {
    if (!this.options.loadingIndicator.name) {
      return
    }
    let indicatorPath = path.resolve(
      this.template.dir,
      'views/loading',
      this.options.loadingIndicator.name + '.html'
    )

    let customIndicator = false
    if (!await fsExtra.exists(indicatorPath)) {
      indicatorPath = this.nuxt.resolver.resolveAlias(
        this.options.loadingIndicator.name
      )

      if (await fsExtra.exists(indicatorPath)) {
        customIndicator = true
      } else {
        indicatorPath = null
      }
    }

    if (!indicatorPath) {
      consola.error(
        `Could not fetch loading indicator: ${
          this.options.loadingIndicator.name
        }`
      )
      return
    }

    templateFiles.push({
      src: indicatorPath,
      dst: 'loading.html',
      custom: customIndicator,
      options: this.options.loadingIndicator
    })
  }

  async compileTemplates(templateContext) {
    // Prepare template options
    const { templateVars, templateFiles, templateOptions } = templateContext

    await this.nuxt.callHook('build:templates', {
      templateVars,
      templatesFiles: templateFiles,
      resolve: r
    })

    templateOptions.imports = {
      ...templateOptions.imports,
      resolvePath: this.nuxt.resolver.resolvePath,
      resolveAlias: this.nuxt.resolver.resolveAlias,
      relativeToBuild: this.relativeToBuild
    }

    // Interpret and move template files to .nuxt/
    await Promise.all(
      templateFiles.map(async (templateFile) => {
        const { src, dst, custom } = templateFile

        // Add custom templates to watcher
        if (custom) {
          this.options.build.watch.push(src)
        }

        // Render template to dst
        const fileContent = await fsExtra.readFile(src, 'utf8')
        let content
        try {
          const templateFunction = template(fileContent, templateOptions)
          content = stripWhitespace(
            templateFunction({
              ...templateVars,
              ...templateFile
            })
          )
        } catch (err) {
          throw new Error(`Could not compile template ${src}: ${err.message}`)
        }

        // Ensure parent dir exits and write file
        const relativePath = r(this.options.buildDir, dst)
        await fsExtra.outputFile(relativePath, content, 'utf8')
      })
    )
  }

  resolvePlugins() {
    // Check plugins exist then set alias to their real path
    return Promise.all(this.plugins.map(async (p) => {
      const ext = '{?(.+([^.])),/index.+([^.])}'
      const pluginFiles = await glob(`${p.src}${ext}`)

      if (!pluginFiles || pluginFiles.length === 0) {
        throw new Error(`Plugin not found: ${p.src}`)
      }

      if (pluginFiles.length > 1 && !isIndexFileAndFolder(pluginFiles)) {
        consola.warn({
          message: `Found ${pluginFiles.length} plugins that match the configuration, suggest to specify extension:`,
          additional: '\n' + pluginFiles.map(x => `- ${x}`).join('\n')
        })
      }

      p.src = this.relativeToBuild(p.src)
    }))
  }

  // TODO: Uncomment when generateConfig enabled again
  // async generateConfig() {
  //   const config = path.resolve(this.options.buildDir, 'build.config.js')
  //   const options = omit(this.options, Options.unsafeKeys)
  //   await fsExtra.writeFile(
  //     config,
  //     `export default ${JSON.stringify(options, null, '  ')}`,
  //     'utf8'
  //   )
  // }

  createFileWatcher(patterns, events, listener, watcherCreatedCallback) {
    const options = this.options.watchers.chokidar
    const watcher = chokidar.watch(patterns, options)

    for (const event of events) {
      watcher.on(event, listener)
    }

    // TODO: due to fixes in chokidar this isnt used anymore and could be removed in Nuxt v3
    const { rewatchOnRawEvents } = this.options.watchers
    if (rewatchOnRawEvents && Array.isArray(rewatchOnRawEvents)) {
      watcher.on('raw', (_event) => {
        if (rewatchOnRawEvents.includes(_event)) {
          watcher.close()

          listener()
          this.createFileWatcher(patterns, events, listener, watcherCreatedCallback)
        }
      })
    }

    if (typeof watcherCreatedCallback === 'function') {
      watcherCreatedCallback(watcher)
    }
  }

  assignWatcher(key) {
    return (watcher) => {
      this.watchers[key] = watcher
    }
  }

  watchClient() {
    let patterns = [
      r(this.options.srcDir, this.options.dir.layouts),
      r(this.options.srcDir, this.options.dir.middleware)
    ]

    if (this.options.store) {
      patterns.push(r(this.options.srcDir, this.options.dir.store))
    }

    if (this._nuxtPages && !this._defaultPage) {
      patterns.push(r(this.options.srcDir, this.options.dir.pages))
    }

    patterns = patterns.map((path, ...args) => upath.normalizeSafe(this.globPathWithExtensions(path), ...args))

    const refreshFiles = debounce(() => this.generateRoutesAndFiles(), 200)

    // Watch for src Files
    this.createFileWatcher(patterns, ['add', 'unlink'], refreshFiles, this.assignWatcher('files'))

    // Watch for custom provided files
    const customPatterns = uniq([
      ...this.options.build.watch,
      ...Object.values(omit(this.options.build.styleResources, ['options']))
    ]).map(upath.normalizeSafe)

    if (customPatterns.length === 0) {
      return
    }

    this.createFileWatcher(customPatterns, ['change'], refreshFiles, this.assignWatcher('custom'))
  }

  getServerMiddlewarePaths() {
    return this.options.serverMiddleware
      .map((serverMiddleware) => {
        if (isString(serverMiddleware)) {
          return serverMiddleware
        }
        if (isPureObject(serverMiddleware) && isString(serverMiddleware.handler)) {
          return serverMiddleware.handler
        }
      })
      .filter(Boolean)
      .map(p => path.extname(p) ? p : this.nuxt.resolver.resolvePath(p))
  }

  watchRestart() {
    const serverMiddlewarePaths = this.getServerMiddlewarePaths()
    const nuxtRestartWatch = [
      // Server middleware
      ...serverMiddlewarePaths,
      // Custom watchers
      ...this.options.watch
    ].map(this.nuxt.resolver.resolveAlias)

    if (this.ignore.ignoreFile) {
      nuxtRestartWatch.push(this.ignore.ignoreFile)
    }
    // If default page displayed, watch for first page creation
    if (this._nuxtPages && this._defaultPage) {
      nuxtRestartWatch.push(path.join(this.options.srcDir, this.options.dir.pages))
    }
    // If store not activated, watch for a file in the directory
    if (!this.options.store) {
      nuxtRestartWatch.push(path.join(this.options.srcDir, this.options.dir.store))
    }

    this.createFileWatcher(
      nuxtRestartWatch,
      ['all'],
      async (event, fileName) => {
        if (['add', 'change', 'unlink'].includes(event) === false) {
          return
        }
        /* istanbul ignore if */
        if (serverMiddlewarePaths.includes(fileName)) {
          consola.debug(`Clear cache for ${fileName}`)
          clearRequireCache(fileName)
        }
        await this.nuxt.callHook('watch:fileChanged', this, fileName) // Legacy
        await this.nuxt.callHook('watch:restart', { event, path: fileName })
      },
      this.assignWatcher('restart')
    )
  }

  unwatch() {
    for (const watcher in this.watchers) {
      this.watchers[watcher].close()
    }
  }

  async close() {
    if (this.__closed) {
      return
    }
    this.__closed = true

    // Unwatch
    this.unwatch()

    // Close bundleBuilder
    if (typeof this.bundleBuilder.close === 'function') {
      await this.bundleBuilder.close()
    }
  }
}

const STATUS = {
  INITIAL: 1,
  BUILD_DONE: 2,
  BUILDING: 3
}
