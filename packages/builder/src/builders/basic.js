import path from 'path'
import pify from 'pify'
import uniqBy from 'lodash/uniqBy'
import omit from 'lodash/omit'
import template from 'lodash/template'
import fsExtra from 'fs-extra'
import hash from 'hash-sum'
import serialize from 'serialize-javascript'
import Glob from 'glob'
import consola from 'consola'

import devalue from '@nuxtjs/devalue'

import {
  Options,
  r,
  wp,
  wChunk,
  createRoutes,
  relativeTo,
  waitFor,
  determineGlobals
} from '@nuxt/common'

const glob = pify(Glob)

export default class BasicBuilder {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.isStatic = false // Flag to know if the build is for a generated app
    this.options = nuxt.options
    this.globals = determineGlobals(nuxt.options.globalName, nuxt.options.globals)

    // Helper to resolve build paths
    this.relativeToBuild = (...args) =>
      relativeTo(this.options.buildDir, ...args)

    this._buildStatus = STATUS.INITIAL

    // Stop watching on nuxt.close()
    if (this.options.dev) {
      this.nuxt.hook('close', () => this.unwatch())
    }

    if (this.options.build.analyze) {
      this.nuxt.hook('build:done', () => {
        consola.warn({
          message: 'Notice: Please do not deploy bundles built with analyze mode, it\'s only for analyzing purpose.',
          badge: true
        })
      })
    }

    // Resolve template
    this.template = this.options.build.template || '@nuxt/app'
    if (typeof this.template === 'string') {
      this.template = this.nuxt.resolver.requireModule(this.template)
    }

    // if(!this.options.dev) {
    // TODO: enable again when unsafe concern resolved.(common/options.js:42)
    // this.nuxt.hook('build:done', () => this.generateConfig())
    // }
  }

  normalizePlugins() {
    return uniqBy(
      this.options.plugins.map((p) => {
        if (typeof p === 'string') p = { src: p }
        const pluginBaseName = path.basename(p.src, path.extname(p.src)).replace(
          /[^a-zA-Z?\d\s:]/g,
          ''
        )
        return {
          src: this.nuxt.resolver.resolveAlias(p.src),
          ssr: p.ssr !== false,
          name: 'nuxt_plugin_' + pluginBaseName + '_' + hash(p.src)
        }
      }),
      p => p.name
    )
  }

  forGenerate() {
    this.isStatic = true
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

    consola.info({
      message: 'Building project',
      badge: true,
      clear: !this.options.dev
    })

    // Wait for nuxt ready
    await this.nuxt.ready()

    // Call before hook
    await this.nuxt.callHook('build:before', this, this.options.build)

    // Check if pages dir exists and warn if not
    this._nuxtPages = typeof this.options.build.createRoutes !== 'function'
    if (this._nuxtPages) {
      if (!fsExtra.existsSync(path.join(this.options.srcDir, this.options.dir.pages))) {
        const dir = this.options.srcDir
        if (fsExtra.existsSync(path.join(this.options.srcDir, '..', this.options.dir.pages))) {
          throw new Error(
            `No \`${this.options.dir.pages}\` directory found in ${dir}. Did you mean to run \`nuxt\` in the parent (\`../\`) directory?`
          )
        } else {
          this._defaultPage = true
          consola.warn({
            message: `No \`${this.options.dir.pages}\` directory found in ${dir}.`,
            additional: 'Using the default built-in page.\n',
            additionalStyle: 'yellowBright',
            badge: true
          })
        }
      }
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

    // Start bundle build: webpack, rollup, parcel...
    await this.bundleBuild()

    // Flag to set that building is done
    this._buildStatus = STATUS.BUILD_DONE

    // Call done hook
    await this.nuxt.callHook('build:done', this)

    return this
  }

  async generateRoutesAndFiles() {
    consola.debug(`Generating nuxt files`)

    this.plugins = this.normalizePlugins()

    // -- Templates --
    let templatesFiles = Array.from(this.template.templatesFiles)

    const templateVars = {
      options: this.options,
      extensions: this.options.extensions
        .map(ext => ext.replace(/^\./, ''))
        .join('|'),
      messages: this.options.messages,
      splitChunks: this.options.build.splitChunks,
      uniqBy,
      isDev: this.options.dev,
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
      const layoutsFiles = await glob(`${this.options.dir.layouts}/**/*.{vue,js}`, {
        cwd: this.options.srcDir,
        ignore: this.options.ignore
      })
      layoutsFiles.forEach((file) => {
        const name = file
          .replace(new RegExp(`^${this.options.dir.layouts}/`), '')
          .replace(/\.(vue|js)$/, '')
        if (name === 'error') {
          if (!templateVars.components.ErrorPage) {
            templateVars.components.ErrorPage = this.relativeToBuild(
              this.options.srcDir,
              file
            )
          }
          return
        }
        if (!templateVars.layouts[name] || /\.vue$/.test(file)) {
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
        this.template.templatesDir + '/pages'
      )
    } else if (this._nuxtPages) { // If user defined a custom method to create routes
      // Use nuxt.js createRoutes bases on pages/
      const files = {}
      ;(await glob(`${this.options.dir.pages}/**/*.{vue,js}`, {
        cwd: this.options.srcDir,
        ignore: this.options.ignore
      })).forEach((f) => {
        const key = f.replace(/\.(js|vue)$/, '')
        if (/\.vue$/.test(f) || !files[key]) {
          files[key] = f.replace(/('|")/g, '\\$1')
        }
      })
      templateVars.router.routes = createRoutes(
        Object.values(files),
        this.options.srcDir,
        this.options.dir.pages
      )
    } else {
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
          src: customFileExists ? customPath : r(this.template.templatesDir, file),
          dst: file,
          custom: customFileExists
        }
      })
      .filter(i => !!i)

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
      const indicatorPath1 = path.resolve(
        this.template.templatesDir,
        'views/loading',
        this.options.loadingIndicator.name + '.html'
      )
      const indicatorPath2 = this.nuxt.resolver.resolveAlias(
        this.options.loadingIndicator.name
      )
      const indicatorPath = fsExtra.existsSync(indicatorPath1)
        ? indicatorPath1
        : fsExtra.existsSync(indicatorPath2) ? indicatorPath2 : null
      if (indicatorPath) {
        templatesFiles.push({
          src: indicatorPath,
          dst: 'loading.html',
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

    // Interpret and move template files to .nuxt/
    await Promise.all(
      templatesFiles.map(async ({ src, dst, options, custom }) => {
        // Add template to watchers
        this.options.build.watch.push(src)
        // Render template to dst
        const fileContent = await fsExtra.readFile(src, 'utf8')
        let content
        try {
          const templateFunction = template(fileContent, {
            imports: {
              serialize,
              devalue,
              hash,
              r,
              wp,
              wChunk,
              resolvePath: this.nuxt.resolver.resolvePath,
              resolveAlias: this.nuxt.resolver.resolveAlias,
              relativeToBuild: this.relativeToBuild
            },
            interpolate: /<%=([\s\S]+?)%>/g
          })
          content = templateFunction(
            Object.assign({}, templateVars, {
              options: options || {},
              custom,
              src,
              dst
            })
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

  bundleBuild() {
    throw new Error('Method:[bundleBuild] need to be implemented!')
  }

  watchClient() {
    throw new Error('Method:[watchClient] need to be implemented!')
  }

  watchServer() {
    throw new Error('Method:[watchServer] need to be implemented!')
  }

  unwatch() {
    throw new Error('Method:[unwatch] need to be implemented!')
  }

  // TODO: remove ignore when generateConfig enabled again
  async generateConfig() /* istanbul ignore next */ {
    const config = path.resolve(this.options.buildDir, 'build.config.js')
    const options = omit(this.options, Options.unsafeKeys)
    await fsExtra.writeFile(
      config,
      `export default ${JSON.stringify(options, null, '  ')}`,
      'utf8'
    )
  }
}

const STATUS = {
  INITIAL: 1,
  BUILD_DONE: 2,
  BUILDING: 3
}
