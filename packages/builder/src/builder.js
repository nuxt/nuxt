import path from 'path'
import chokidar from 'chokidar'
import consola from 'consola'
import fsExtra from 'fs-extra'
import Glob from 'glob'
import hash from 'hash-sum'
import pify from 'pify'
import serialize from 'serialize-javascript'
import upath from 'upath'
import semver from 'semver'

import debounce from 'lodash/debounce'
import omit from 'lodash/omit'
import template from 'lodash/template'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'

import devalue from '@nuxt/devalue'

import {
  r,
  wp,
  wChunk,
  createRoutes,
  relativeTo,
  waitFor,
  serializeFunction,
  determineGlobals,
  stripWhitespace,
  isString,
  isIndexFileAndFolder
} from '@nuxt/utils'

import BuildContext from './context'

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
    this.relativeToBuild = (...args) =>
      relativeTo(this.options.buildDir, ...args)

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

    // if(!this.options.dev) {
    // TODO: enable again when unsafe concern resolved.(common/options.js:42)
    // this.nuxt.hook('build:done', () => this.generateConfig())
    // }

    this.bundleBuilder = this.getBundleBuilder(bundleBuilder)
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

  normalizePlugins() {
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

      const modes = ['client', 'server']
      const modePattern = new RegExp(`\\.(${modes.join('|')})\\.\\w+$`)
      pluginFiles[0].replace(modePattern, (_, mode) => {
        // mode in nuxt.config has higher priority
        if (p.mode === 'all' && modes.includes(mode)) {
          p.mode = mode
        }
      })

      p.src = this.relativeToBuild(p.src)
    }))
  }

  forGenerate() {
    this.bundleBuilder.forGenerate()
  }

  async build() {
    // Avoid calling build() method multiple times when dev:true
    /* istanbul ignore if */
    if (this._buildStatus === STATUS.BUILD_DONE && this.options.dev) {
      return this
    }
    // If building
    /* istanbul ignore if */
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
    const dpendencyFixes = []
    for (const depName in templateDependencies) {
      const depVersion = templateDependencies[depName]
      const requiredVersion = `${depName}@${depVersion}`

      // Load installed version
      const pkg = this.nuxt.resolver.requireModule(path.join(depName, 'package.json'))
      if (pkg) {
        const validVersion = semver.satisfies(pkg.version, depVersion)
        if (!validVersion) {
          consola.warn(`${requiredVersion} is required but ${depName}@${pkg.version} is installed!`)
          dpendencyFixes.push(requiredVersion)
        }
      } else {
        consola.warn(`${depName}@${depVersion} is required but not installed!`)
        dpendencyFixes.push(requiredVersion)
      }
    }

    // Suggest dependency fixes (TODO: automate me)
    if (dpendencyFixes.length) {
      consola.error(
        `Please install missing dependencies:\n`,
        '\n',
        `Using yarn:\n`,
        `yarn add ${dpendencyFixes.join(' ')}\n`,
        '\n',
        `Using npm:\n`,
        `npm i ${dpendencyFixes.join(' ')}\n`
      )
      throw new Error('Missing Template Dependencies')
    }
  }

  async generateRoutesAndFiles() {
    consola.debug(`Generating nuxt files`)

    // Plugins
    this.plugins = Array.from(this.normalizePlugins())

    // -- Templates --
    let templatesFiles = Array.from(this.template.files)

    const templateVars = {
      options: this.options,
      extensions: this.options.extensions
        .map(ext => ext.replace(/^\./, ''))
        .join('|'),
      messages: this.options.messages,
      splitChunks: this.options.build.splitChunks,
      uniqBy,
      isDev: this.options.dev,
      isTest: this.options.test,
      debug: this.options.debug,
      vue: { config: this.options.vue.config },
      mode: this.options.mode,
      router: this.options.router,
      env: this.options.env,
      head: this.options.head,
      middleware: fsExtra.existsSync(path.join(this.options.srcDir, this.options.dir.middleware)),
      store: this.options.store,
      globalName: this.options.globalName,
      globals: this.globals,
      css: this.options.css,
      plugins: this.plugins,
      appPath: './App.js',
      ignorePrefix: this.options.ignorePrefix,
      layouts: Object.assign({}, this.options.layouts),
      loading:
        typeof this.options.loading === 'string'
          ? this.relativeToBuild(this.options.srcDir, this.options.loading)
          : this.options.loading,
      transition: this.options.transition,
      layoutTransition: this.options.layoutTransition,
      dir: this.options.dir,
      components: {
        ErrorPage: this.options.ErrorPage
          ? this.relativeToBuild(this.options.ErrorPage)
          : null
      }
    }

    // -- Layouts --
    if (fsExtra.existsSync(path.resolve(this.options.srcDir, this.options.dir.layouts))) {
      const configLayouts = this.options.layouts
      const layoutsFiles = await glob(`${this.options.dir.layouts}/**/*.{${this.supportedExtensions.join(',')}}`, {
        cwd: this.options.srcDir,
        ignore: this.options.ignore
      })
      layoutsFiles.forEach((file) => {
        const name = file
          .replace(new RegExp(`^${this.options.dir.layouts}/`), '')
          .replace(new RegExp(`\\.(${this.supportedExtensions.join('|')})$`), '')
        if (name === 'error') {
          if (!templateVars.components.ErrorPage) {
            templateVars.components.ErrorPage = this.relativeToBuild(
              this.options.srcDir,
              file
            )
          }
          return
        }
        // Layout Priority: module.addLayout > .vue file > other extensions
        if (configLayouts[name]) {
          consola.warn(`Duplicate layout registration, "${name}" has been registered as "${configLayouts[name]}"`)
        } else if (!templateVars.layouts[name] || /\.vue$/.test(file)) {
          templateVars.layouts[name] = this.relativeToBuild(
            this.options.srcDir,
            file
          )
        }
      })
    }
    // If no default layout, create its folder and add the default folder
    if (!templateVars.layouts.default) {
      await fsExtra.mkdirp(r(this.options.buildDir, 'layouts'))
      templatesFiles.push('layouts/default.vue')
      templateVars.layouts.default = './layouts/default.vue'
    }

    // -- Routes --
    consola.debug('Generating routes...')

    if (this._defaultPage) {
      templateVars.router.routes = createRoutes(
        ['index.vue'],
        this.template.dir + '/pages',
        '',
        this.options.router.routeNameSplitter
      )
    } else if (this._nuxtPages) {
      // Use nuxt.js createRoutes bases on pages/
      const files = {}
      ;(await glob(`${this.options.dir.pages}/**/*.{${this.supportedExtensions.join(',')}}`, {
        cwd: this.options.srcDir,
        ignore: this.options.ignore
      })).forEach((f) => {
        const key = f.replace(new RegExp(`\\.(${this.supportedExtensions.join('|')})$`), '')
        // .vue file takes precedence over other extensions
        if (/\.vue$/.test(f) || !files[key]) {
          files[key] = f.replace(/(['"])/g, '\\$1')
        }
      })
      templateVars.router.routes = createRoutes(
        Object.values(files),
        this.options.srcDir,
        this.options.dir.pages,
        this.options.router.routeNameSplitter
      )
    } else { // If user defined a custom method to create routes
      templateVars.router.routes = this.options.build.createRoutes(
        this.options.srcDir
      )
    }

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

    // Make routes accessible for other modules and webpack configs
    this.routes = templateVars.router.routes

    // -- Store --
    // Add store if needed
    if (this.options.store) {
      templatesFiles.push('store.js')
    }

    // Resolve template files
    const customTemplateFiles = this.options.build.templates.map(
      t => t.dst || path.basename(t.src || t)
    )

    templatesFiles = templatesFiles
      .map((file) => {
        // Skip if custom file was already provided in build.templates[]
        if (customTemplateFiles.includes(file)) {
          return
        }
        // Allow override templates using a file with same name in ${srcDir}/app
        const customPath = r(this.options.srcDir, 'app', file)
        const customFileExists = fsExtra.existsSync(customPath)

        return {
          src: customFileExists ? customPath : r(this.template.dir, file),
          dst: file,
          custom: customFileExists
        }
      })
      .filter(Boolean)

    // -- Custom templates --
    // Add custom template files
    templatesFiles = templatesFiles.concat(
      this.options.build.templates.map((t) => {
        return Object.assign(
          {
            src: r(this.options.srcDir, t.src || t),
            dst: t.dst || path.basename(t.src || t),
            custom: true
          },
          t
        )
      })
    )

    // -- Loading indicator --
    if (this.options.loadingIndicator.name) {
      let indicatorPath = path.resolve(
        this.template.dir,
        'views/loading',
        this.options.loadingIndicator.name + '.html'
      )

      let customIndicator = false
      if (!fsExtra.existsSync(indicatorPath)) {
        indicatorPath = this.nuxt.resolver.resolveAlias(
          this.options.loadingIndicator.name
        )

        if (fsExtra.existsSync(indicatorPath)) {
          customIndicator = true
        } else {
          indicatorPath = null
        }
      }

      if (indicatorPath) {
        templatesFiles.push({
          src: indicatorPath,
          dst: 'loading.html',
          custom: customIndicator,
          options: this.options.loadingIndicator
        })
      } else {
        /* istanbul ignore next */
        // eslint-disable-next-line no-console
        console.error(
          `Could not fetch loading indicator: ${
            this.options.loadingIndicator.name
          }`
        )
      }
    }

    await this.nuxt.callHook('build:templates', {
      templatesFiles,
      templateVars,
      resolve: r
    })

    // Prepare template options
    let lodash = null
    const templateOptions = {
      imports: {
        serialize,
        serializeFunction,
        devalue,
        hash,
        r,
        wp,
        wChunk,
        resolvePath: this.nuxt.resolver.resolvePath,
        resolveAlias: this.nuxt.resolver.resolveAlias,
        relativeToBuild: this.relativeToBuild,
        // Legacy support: https://github.com/nuxt/nuxt.js/issues/4350
        _: new Proxy({}, {
          get(target, prop) {
            if (!lodash) {
              consola.warn('Avoid using _ inside templates')
              lodash = require('lodash')
            }
            return lodash[prop]
          }
        })
      },
      interpolate: /<%=([\s\S]+?)%>/g
    }

    // Add vue-app template dir to watchers
    this.options.build.watch.push(this.template.dir)

    // Interpret and move template files to .nuxt/
    await Promise.all(
      templatesFiles.map(async ({ src, dst, options, custom }) => {
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
            templateFunction(
              Object.assign({}, templateVars, {
                options: options || {},
                custom,
                src,
                dst
              })
            )
          )
        } catch (err) {
          /* istanbul ignore next */
          throw new Error(`Could not compile template ${src}: ${err.message}`)
        }
        const _path = r(this.options.buildDir, dst)
        // Ensure parent dir exits and write file
        await fsExtra.outputFile(_path, content, 'utf8')
      })
    )

    consola.success('Nuxt files generated')
  }

  // TODO: Uncomment when generateConfig enabled again
  // async generateConfig() /* istanbul ignore next */ {
  //   const config = path.resolve(this.options.buildDir, 'build.config.js')
  //   const options = omit(this.options, Options.unsafeKeys)
  //   await fsExtra.writeFile(
  //     config,
  //     `export default ${JSON.stringify(options, null, '  ')}`,
  //     'utf8'
  //   )
  // }

  watchClient() {
    const src = this.options.srcDir
    const rGlob = dir => ['*', '**/*'].map(glob => r(src, `${dir}/${glob}.{${this.supportedExtensions.join(',')}}`))

    let patterns = [
      r(src, this.options.dir.layouts),
      r(src, this.options.dir.store),
      r(src, this.options.dir.middleware),
      ...rGlob(this.options.dir.layouts)
    ]

    if (this._nuxtPages) {
      patterns.push(
        r(src, this.options.dir.pages),
        ...rGlob(this.options.dir.pages)
      )
    }

    patterns = patterns.map(upath.normalizeSafe)

    const options = this.options.watchers.chokidar
    /* istanbul ignore next */
    const refreshFiles = debounce(() => this.generateRoutesAndFiles(), 200)

    // Watch for src Files
    this.watchers.files = chokidar
      .watch(patterns, options)
      .on('add', refreshFiles)
      .on('unlink', refreshFiles)

    this.watchCustom(refreshFiles)
  }

  watchCustom(refreshFiles, refresh) {
    const options = this.options.watchers.chokidar
    // Watch for custom provided files
    const customPatterns = uniq([
      ...this.options.build.watch,
      ...Object.values(omit(this.options.build.styleResources, ['options']))
    ]).map(upath.normalizeSafe)

    if (customPatterns.length === 0) {
      return
    }

    if (refresh) {
      refreshFiles()
    }

    this.watchers.custom = chokidar
      .watch(customPatterns, options)
      .on('change', refreshFiles)

    const { rewatchOnRawEvents } = this.options.watchers
    if (rewatchOnRawEvents && Array.isArray(rewatchOnRawEvents)) {
      this.watchers.custom.on('raw', (_event, _path, opts) => {
        if (rewatchOnRawEvents.includes(_event)) {
          this.watchers.custom.close()
          this.watchers.custom = null

          this.watchCustom(refreshFiles, true)
        }
      })
    }
  }

  watchRestart() {
    const nuxtRestartWatch = [
      // Server middleware
      ...this.options.serverMiddleware.filter(isString),
      // Custom watchers
      ...this.options.watch
    ].map(this.nuxt.resolver.resolveAlias)

    this.watchers.restart = chokidar
      .watch(nuxtRestartWatch, this.options.watchers.chokidar)
      .on('all', (event, _path) => {
        if (['add', 'change', 'unlink'].includes(event) === false) {
          return
        }
        this.nuxt.callHook('watch:fileChanged', this, _path) // Legacy
        this.nuxt.callHook('watch:restart', { event, path: _path })
      })
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
