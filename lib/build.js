'use strict'

import _ from 'lodash'
import chokidar from 'chokidar'
import fs from 'fs-extra'
import hash from 'hash-sum'
import pify from 'pify'
import webpack from 'webpack'
import PostCompilePlugin from 'post-compile-webpack-plugin'
import serialize from 'serialize-javascript'
import { createBundleRenderer } from 'vue-server-renderer'
import { join, resolve, basename, dirname, relative } from 'path'
import { isUrl, r, wp } from './utils'
import clientWebpackConfig from './webpack/client.config.js'
import serverWebpackConfig from './webpack/server.config.js'
const debug = require('debug')('nuxt:build')
const remove = pify(fs.remove)
const readFile = pify(fs.readFile)
const utimes = pify(fs.utimes)
const writeFile = pify(fs.writeFile)
const mkdirp = pify(fs.mkdirp)
const glob = pify(require('glob'))

let webpackStats = 'none'
debug.color = 2 // force green color

const defaults = {
  analyze: false,
  extractCSS: false,
  publicPath: '/_nuxt/',
  filenames: {
    css: 'common.[chunkhash].css',
    manifest: 'manifest.[hash].js',
    vendor: 'vendor.bundle.[chunkhash].js',
    app: 'nuxt.bundle.[chunkhash].js'
  },
  vendor: [],
  plugins: [],
  babel: {},
  postcss: [],
  templates: [],
  watch: []
}

const defaultsPostcss = [
  require('autoprefixer')({
    browsers: ['last 3 versions']
  })
]

export function options () {
  // Defaults build options
  let extraDefaults = {}
  if (this.options.build && !Array.isArray(this.options.build.postcss)) extraDefaults.postcss = defaultsPostcss
  this.options.build = _.defaultsDeep(this.options.build, defaults, extraDefaults)
  /* istanbul ignore if */
  if (this.dev && isUrl(this.options.build.publicPath)) {
    this.options.build.publicPath = defaults.publicPath
  }
}

export function production () {
  // Production, create server-renderer
  webpackStats = {
    chunks: false,
    children: false,
    modules: false,
    colors: true
  }
  const serverConfig = getWebpackServerConfig.call(this)
  const bundlePath = join(serverConfig.output.path, 'server-bundle.json')
  const manifestPath = join(serverConfig.output.path, 'client-manifest.json')
  if (fs.existsSync(bundlePath) && fs.existsSync(manifestPath)) {
    const bundle = fs.readFileSync(bundlePath, 'utf8')
    const manifest = fs.readFileSync(manifestPath, 'utf8')
    createRenderer.call(this, JSON.parse(bundle), JSON.parse(manifest))
    addAppTemplate.call(this)
  }
}

export async function build () {
  // Avoid calling this method multiple times
  if (this._buildDone) {
    return this
  }
  // If building
  if (this._building) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.build())
      }, 300)
    })
  }
  this._building = true
  // Wait for Nuxt.js to be ready
  await this.ready()
  // Check if pages dir exists and warn if not
  this._nuxtPages = typeof this.createRoutes !== 'function'
  if (this._nuxtPages) {
    if (!fs.existsSync(join(this.srcDir, 'pages'))) {
      if (fs.existsSync(join(this.srcDir, '..', 'pages'))) {
        console.error('> No `pages` directory found. Did you mean to run `nuxt` in the parent (`../`) directory?') // eslint-disable-line no-console
      } else {
        console.error('> Couldn\'t find a `pages` directory. Please create one under the project root') // eslint-disable-line no-console
      }
      process.exit(1)
    }
  }
  debug(`App root: ${this.srcDir}`)
  debug(`Generating ${this.buildDir} files...`)
  // Create .nuxt/, .nuxt/components and .nuxt/dist folders
  await remove(r(this.buildDir))
  await mkdirp(r(this.buildDir, 'components'))
  if (!this.dev) {
    await mkdirp(r(this.buildDir, 'dist'))
  }
  // Generate routes and interpret the template files
  await generateRoutesAndFiles.call(this)
  // Generate .nuxt/dist/ files
  await buildFiles.call(this)
  // Flag to set that building is done
  this._buildDone = true
  return this
}

async function buildFiles () {
  if (this.dev) {
    debug('Adding webpack middleware...')
    createWebpackMiddleware.call(this)
    webpackWatchAndUpdate.call(this)
    watchFiles.call(this)
  } else {
    debug('Building files...')
    await webpackRunClient.call(this)
    await webpackRunServer.call(this)
    addAppTemplate.call(this)
  }
}

function addAppTemplate () {
  let templatePath = resolve(this.buildDir, 'dist', 'index.html')
  if (fs.existsSync(templatePath)) {
    this.appTemplate = _.template(fs.readFileSync(templatePath, 'utf8'), {
      interpolate: /{{([\s\S]+?)}}/g
    })
  }
}

async function generateRoutesAndFiles () {
  debug('Generating files...')
  // -- Templates --
  let templatesFiles = [
    'App.vue',
    'client.js',
    'index.js',
    'middleware.js',
    'router.js',
    'server.js',
    'utils.js',
    'components/nuxt-error.vue',
    'components/nuxt-loading.vue',
    'components/nuxt-child.js',
    'components/nuxt-link.js',
    'components/nuxt.vue'
  ]

  const srcImportDir = relative(this.buildDir, this.srcDir)
  const templateVars = {
    options: this.options,
    uniqBy: _.uniqBy,
    isDev: this.dev,
    router: {
      mode: this.options.router.mode,
      base: this.options.router.base,
      middleware: this.options.router.middleware,
      linkActiveClass: this.options.router.linkActiveClass,
      linkExactActiveClass: this.options.router.linkExactActiveClass,
      scrollBehavior: this.options.router.scrollBehavior
    },
    env: this.options.env,
    head: this.options.head,
    middleware: fs.existsSync(join(this.srcDir, 'middleware')),
    store: this.options.store || fs.existsSync(join(this.srcDir, 'store')),
    css: this.options.css,
    plugins: this.options.plugins.map((p, i) => {
      if (typeof p === 'string') p = { src: p }
      p.src = r(this.srcDir, p.src)
      return { src: p.src, ssr: (p.ssr !== false), name: `plugin${i}` }
    }),
    appPath: './App.vue',
    layouts: Object.assign({}, this.options.layouts),
    loading: (typeof this.options.loading === 'string' ? r(this.srcDir, this.options.loading) : this.options.loading),
    transition: this.options.transition,
    components: {
      ErrorPage: this.options.ErrorPage ? join(srcImportDir, this.options.ErrorPage) : null
    }
  }

  // -- Layouts --
  if (fs.existsSync(resolve(this.srcDir, 'layouts'))) {
    const layoutsFiles = await glob('layouts/*.vue', {cwd: this.srcDir})
    layoutsFiles.forEach((file) => {
      let name = file.split('/').slice(-1)[0].replace('.vue', '')
      if (name === 'error') return
      templateVars.layouts[name] = join(srcImportDir, file)
    })
    if (layoutsFiles.includes('layouts/error.vue')) {
      templateVars.components.ErrorPage = join(srcImportDir, 'layouts/error.vue')
    }
  }
  // If no default layout, create its folder and add the default folder
  if (!templateVars.layouts.default) {
    await mkdirp(r(this.buildDir, 'layouts'))
    templatesFiles.push('layouts/default.vue')
    templateVars.layouts.default = join(relative(this.buildDir, __dirname), 'app', 'layouts', 'default.vue')
  }

  // -- Routes --
  debug('Generating routes...')
  // If user defined a custom method to create routes
  if (this._nuxtPages) {
    // Use nuxt.js createRoutes bases on pages/
    const files = await glob('pages/**/*.vue', {cwd: this.srcDir})
    templateVars.router.routes = createRoutes(files, srcImportDir)
  } else {
    templateVars.router.routes = this.createRoutes(srcImportDir)
  }
  // router.extendRoutes method
  if (typeof this.options.router.extendRoutes === 'function') {
    // let the user extend the routes
    this.options.router.extendRoutes.call(this, templateVars.router.routes || [], r)
  }
  // Routes for generate command
  this.routes = flatRoutes(templateVars.router.routes || [])

  // -- Store --
  // Add store if needed
  if (this.options.store) {
    templatesFiles.push('store.js')
  }

  // Resolve template files
  const customTemplateFiles = this.options.build.templates.map(t => t.dst || basename(t.src || t))
  templatesFiles = templatesFiles.map(file => {
    // Skip if custom file was already provided in build.templates[]
    if (customTemplateFiles.indexOf(file) !== -1) {
      return
    }
    // Allow override templates using a file with same name in ${srcDir}/app
    const customPath = r(this.srcDir, 'app', file)
    const customFileExists = fs.existsSync(customPath)
    return {
      src: customFileExists ? customPath : r(__dirname, 'app', file),
      dst: file,
      custom: customFileExists
    }
  }).filter(i => !!i)

  // -- Custom templates --
  // Add custom template files
  templatesFiles = templatesFiles.concat(this.options.build.templates.map(t => {
    return Object.assign({
      src: r(this.dir, t.src || t),
      dst: t.dst || basename(t.src || t),
      custom: true
    }, t)
  }))

  // Interpret and move template files to .nuxt/
  return Promise.all(templatesFiles.map(async ({ src, dst, options, custom }) => {
    // Add template to watchers
    this.options.build.watch.push(src)
    // Render template to dst
    const fileContent = await readFile(src, 'utf8')
    const template = _.template(fileContent, {
      imports: {
        serialize,
        hash,
        r,
        wp
      }
    })
    const content = template(Object.assign({}, templateVars, {
      options: options || {},
      custom,
      src,
      dst
    }))
    const path = r(this.buildDir, dst)
    // Ensure parent dir exits
    await mkdirp(dirname(path))
    // Write file
    await writeFile(path, content, 'utf8')
    // Fix webpack loop (https://github.com/webpack/watchpack/issues/25#issuecomment-287789288)
    const dateFS = Date.now() / 1000 - 30
    return utimes(path, dateFS, dateFS)
  }))
}

function createRoutes (files, importDir) {
  let routes = []
  files.forEach((file) => {
    let keys = file.replace(/^pages/, '').replace(/\.vue$/, '').replace(/\/{2,}/g, '/').split('/').slice(1)
    let route = { name: '', path: '', component: join(importDir, file) }
    let parent = routes
    keys.forEach((key, i) => {
      route.name = route.name ? route.name + '-' + key.replace('_', '') : key.replace('_', '')
      route.name += (key === '_') ? 'all' : ''
      let child = _.find(parent, { name: route.name })
      if (child) {
        if (!child.children) {
          child.children = []
        }
        parent = child.children
        route.path = ''
      } else {
        if (key === 'index' && (i + 1) === keys.length) {
          route.path += (i > 0 ? '' : '/')
        } else {
          route.path += '/' + (key === '_' ? '*' : key.replace('_', ':'))
          if (key !== '_' && key.indexOf('_') !== -1) {
            route.path += '?'
          }
        }
      }
    })
    // Order Routes path
    parent.push(route)
    parent.sort((a, b) => {
      if (!a.path.length || a.path === '/') { return -1 }
      if (!b.path.length || b.path === '/') { return 1 }
      var res = 0
      var _a = a.path.split('/')
      var _b = b.path.split('/')
      for (var i = 0; i < _a.length; i++) {
        if (res !== 0) { break }
        var y = (_a[i].indexOf('*') > -1) ? 2 : (_a[i].indexOf(':') > -1 ? 1 : 0)
        var z = (_b[i].indexOf('*') > -1) ? 2 : (_b[i].indexOf(':') > -1 ? 1 : 0)
        res = y - z
        if (i === _b.length - 1 && res === 0) {
          res = 1
        }
      }
      return res === 0 ? -1 : res
    })
  })
  return cleanChildrenRoutes(routes)
}

function cleanChildrenRoutes (routes, isChild = false) {
  let start = -1
  let routesIndex = []
  routes.forEach((route) => {
    if (/-index$/.test(route.name) || route.name === 'index') {
      // Save indexOf 'index' key in name
      let res = route.name.split('-')
      let s = res.indexOf('index')
      start = (start === -1 || s < start) ? s : start
      routesIndex.push(res)
    }
  })
  routes.forEach((route) => {
    route.path = (isChild) ? route.path.replace('/', '') : route.path
    if (route.path.indexOf('?') > -1) {
      let names = route.name.split('-')
      let paths = route.path.split('/')
      if (!isChild) { paths.shift() } // clean first / for parents
      routesIndex.forEach((r) => {
        let i = r.indexOf('index') - start //  children names
        if (i < paths.length) {
          for (var a = 0; a <= i; a++) {
            if (a === i) { paths[a] = paths[a].replace('?', '') }
            if (a < i && names[a] !== r[a]) { break }
          }
        }
      })
      route.path = (isChild ? '' : '/') + paths.join('/')
    }
    route.name = route.name.replace(/-index$/, '')
    if (route.children) {
      if (route.children.find((child) => child.path === '')) {
        delete route.name
      }
      route.children = cleanChildrenRoutes(route.children, true)
    }
  })
  return routes
}

function flatRoutes (router, path = '', routes = []) {
  router.forEach((r) => {
    if (!r.path.includes(':') && !r.path.includes('*')) {
      if (r.children) {
        flatRoutes(r.children, path + r.path + '/', routes)
      } else {
        routes.push((r.path === '' && path[path.length - 1] === '/' ? path.slice(0, -1) : path) + r.path)
      }
    }
  })
  return routes
}

function getWebpackClientConfig () {
  return clientWebpackConfig.call(this)
}

function getWebpackServerConfig () {
  return serverWebpackConfig.call(this)
}

function createWebpackMiddleware () {
  const clientConfig = getWebpackClientConfig.call(this)
  const host = process.env.HOST || process.env.npm_package_config_nuxt_host || 'localhost'
  const port = process.env.PORT || process.env.npm_package_config_nuxt_port || '3000'

  // setup on the fly compilation + hot-reload
  clientConfig.entry.app = _.flatten(['webpack-hot-middleware/client?reload=true', clientConfig.entry.app])
  clientConfig.plugins.push(
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new PostCompilePlugin(stats => {
      if (!stats.hasErrors() && !stats.hasWarnings()) {
        // We don't use os.host() here because browsers have special behaviour with localhost
        // For example chrome allows Geolocation api only to https or localhost origins
        let _host = host === '0.0.0.0' ? 'localhost' : host
        console.log(`> Open http://${_host}:${port}\n`) // eslint-disable-line no-console
      }
    })
  )
  const clientCompiler = webpack(clientConfig)
  this.clientCompiler = clientCompiler
  // Add the middleware to the instance context
  this.webpackDevMiddleware = pify(require('webpack-dev-middleware')(clientCompiler, {
    publicPath: clientConfig.output.publicPath,
    stats: webpackStats,
    quiet: true,
    noInfo: true,
    watchOptions: this.options.watchers.webpack
  }))
  this.webpackHotMiddleware = pify(require('webpack-hot-middleware')(clientCompiler, {
    log: () => {}
  }))
  clientCompiler.plugin('done', () => {
    const fs = this.webpackDevMiddleware.fileSystem
    const filePath = join(clientConfig.output.path, 'index.html')
    if (fs.existsSync(filePath)) {
      const template = fs.readFileSync(filePath, 'utf-8')
      this.appTemplate = _.template(template, {
        interpolate: /{{([\s\S]+?)}}/g
      })
    }
    this.watchHandler()
  })
}

function webpackWatchAndUpdate () {
  const MFS = require('memory-fs') // <- dependencies of webpack
  const serverFS = new MFS()
  const clientFS = this.clientCompiler.outputFileSystem
  const serverConfig = getWebpackServerConfig.call(this)
  const serverCompiler = webpack(serverConfig)
  const bundlePath = join(serverConfig.output.path, 'server-bundle.json')
  const manifestPath = join(serverConfig.output.path, 'client-manifest.json')
  serverCompiler.outputFileSystem = serverFS
  const watchHandler = (err) => {
    if (err) throw err
    const bundleExists = serverFS.existsSync(bundlePath)
    const manifestExists = clientFS.existsSync(manifestPath)
    if (bundleExists && manifestExists) {
      const bundle = serverFS.readFileSync(bundlePath, 'utf8')
      const manifest = clientFS.readFileSync(manifestPath, 'utf8')
      createRenderer.call(this, JSON.parse(bundle), JSON.parse(manifest))
    }
  }
  this.watchHandler = watchHandler
  this.webpackServerWatcher = serverCompiler.watch(this.options.watchers.webpack, watchHandler)
}

function webpackRunClient () {
  return new Promise((resolve, reject) => {
    const clientConfig = getWebpackClientConfig.call(this)
    const clientCompiler = webpack(clientConfig)
    clientCompiler.run((err, stats) => {
      if (err) return reject(err)
      console.log('[nuxt:build:client]\n', stats.toString(webpackStats)) // eslint-disable-line no-console
      if (stats.hasErrors()) return reject(new Error('Webpack build exited with errors'))
      resolve()
    })
  })
}

function webpackRunServer () {
  return new Promise((resolve, reject) => {
    const serverConfig = getWebpackServerConfig.call(this)
    const serverCompiler = webpack(serverConfig)
    serverCompiler.run((err, stats) => {
      if (err) return reject(err)
      console.log('[nuxt:build:server]\n', stats.toString(webpackStats)) // eslint-disable-line no-console
      if (stats.hasErrors()) return reject(new Error('Webpack build exited with errors'))
      const bundlePath = join(serverConfig.output.path, 'server-bundle.json')
      const manifestPath = join(serverConfig.output.path, 'client-manifest.json')
      readFile(bundlePath, 'utf8')
      .then(bundle => {
        readFile(manifestPath, 'utf8')
        .then(manifest => {
          createRenderer.call(this, JSON.parse(bundle), JSON.parse(manifest))
          resolve()
        })
      })
    })
  })
}

function createRenderer (bundle, manifest) {
  // Create bundle renderer to give a fresh context for every request
  this.renderer = createBundleRenderer(bundle, Object.assign({
    clientManifest: manifest,
    runInNewContext: false,
    basedir: this.dir
  }, this.options.build.ssr))
  this.renderToString = pify(this.renderer.renderToString)
  this.renderToStream = this.renderer.renderToStream
}

function watchFiles () {
  const patterns = [
    r(this.srcDir, 'layouts'),
    r(this.srcDir, 'store'),
    r(this.srcDir, 'middleware'),
    r(this.srcDir, 'layouts/*.vue'),
    r(this.srcDir, 'layouts/**/*.vue')
  ]
  if (this._nuxtPages) {
    patterns.push(r(this.srcDir, 'pages'))
    patterns.push(r(this.srcDir, 'pages/*.vue'))
    patterns.push(r(this.srcDir, 'pages/**/*.vue'))
  }
  const options = Object.assign({}, this.options.watchers.chokidar, {
    ignoreInitial: true
  })
  /* istanbul ignore next */
  const refreshFiles = _.debounce(async () => {
    await generateRoutesAndFiles.call(this)
  }, 200)
  // Watch for internals
  this.filesWatcher = chokidar.watch(patterns, options)
  .on('add', refreshFiles)
  .on('unlink', refreshFiles)
  // Watch for custom provided files
  this.customFilesWatcher = chokidar.watch(_.uniq(this.options.build.watch), options)
  .on('change', refreshFiles)
}
