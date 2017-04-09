'use strict'

import _ from 'lodash'
import co from 'co'
import chokidar from 'chokidar'
import fs from 'fs-extra'
import hash from 'hash-sum'
import pify from 'pify'
import webpack from 'webpack'
import PostCompilePlugin from 'post-compile-webpack-plugin'
import serialize from 'serialize-javascript'
import { createBundleRenderer } from 'vue-server-renderer'
import { join, resolve, sep } from 'path'
import { isUrl } from './utils'
import clientWebpackConfig from './webpack/client.config.js'
import serverWebpackConfig from './webpack/server.config.js'
const debug = require('debug')('nuxt:build')
const remove = pify(fs.remove)
const readFile = pify(fs.readFile)
const utimes = pify(fs.utimes)
const writeFile = pify(fs.writeFile)
const mkdirp = pify(fs.mkdirp)
const glob = pify(require('glob'))
const reqSep = /\//g
const sysSep = _.escapeRegExp(sep)
const normalize = string => string.replace(reqSep, sysSep)
const wp = function (p) {
  /* istanbul ignore if */
  if (/^win/.test(process.platform)) {
    p = p.replace(/\\/g, '\\\\')
  }
  return p
}
const r = function () {
  let args = Array.from(arguments)
  if (_.last(args).includes('~')) {
    return wp(_.last(args))
  }
  args = args.map(normalize)
  return wp(resolve.apply(null, args))
}
let webpackStats = 'none'
// force green color
debug.color = 2

const defaults = {
  analyze: false,
  publicPath: '/_nuxt/',
  filenames: {
    manifest: 'manifest.[hash].js',
    vendor: 'vendor.bundle.[hash].js',
    app: 'nuxt.bundle.[chunkhash].js'
  },
  vendor: [],
  loaders: [],
  plugins: [],
  babel: {},
  postcss: []
}
const defaultsLoaders = [
  {
    test: /\.(png|jpe?g|gif|svg)$/,
    loader: 'url-loader',
    query: {
      limit: 1000, // 1KO
      name: 'img/[name].[hash:7].[ext]'
    }
  },
  {
    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
    loader: 'url-loader',
    query: {
      limit: 1000, // 1 KO
      name: 'fonts/[name].[hash:7].[ext]'
    }
  }
]
const defaultsPostcss = [
  require('autoprefixer')({
    browsers: ['last 3 versions']
  })
]

export function options () {
  // Defaults build options
  let extraDefaults = {}
  if (this.options.build && !Array.isArray(this.options.build.loaders)) extraDefaults.loaders = defaultsLoaders
  if (this.options.build && !Array.isArray(this.options.build.postcss)) extraDefaults.postcss = defaultsPostcss
  this.options.build = _.defaultsDeep(this.options.build, defaults, extraDefaults)
  /* istanbul ignore if */
  if (this.dev && isUrl(this.options.build.publicPath)) {
    this.options.build.publicPath = defaults.publicPath
  }
  // Production, create server-renderer
  if (!this.dev) {
    webpackStats = {
      chunks: false,
      children: false,
      modules: false,
      colors: true
    }
    const serverConfig = getWebpackServerConfig.call(this)
    const bundlePath = join(serverConfig.output.path, 'server-bundle.json')
    if (fs.existsSync(bundlePath)) {
      const bundle = fs.readFileSync(bundlePath, 'utf8')
      createRenderer.call(this, JSON.parse(bundle))
      addAppTemplate.call(this)
    }
  }
}

export function * build () {
  // Check if pages dir exists and warn if not
  if (!fs.existsSync(join(this.srcDir, 'pages'))) {
    if (fs.existsSync(join(this.srcDir, '..', 'pages'))) {
      console.error('> No `pages` directory found. Did you mean to run `nuxt` in the parent (`../`) directory?')  // eslint-disable-line no-console
    } else {
      console.error('> Couldn\'t find a `pages` directory. Please create one under the project root') // eslint-disable-line no-console
    }
    process.exit(1)
  }
  debug(`App root: ${this.srcDir}`)
  debug('Generating .nuxt/ files...')
  // Create .nuxt/, .nuxt/components and .nuxt/dist folders
  yield remove(r(this.dir, '.nuxt'))
  yield mkdirp(r(this.dir, '.nuxt/components'))
  if (!this.dev) {
    yield mkdirp(r(this.dir, '.nuxt/dist'))
  }
  // Generate routes and interpret the template files
  yield generateRoutesAndFiles.call(this)
  // Generate .nuxt/dist/ files
  yield buildFiles.call(this)
  return this
}

function * buildFiles () {
  if (this.dev) {
    debug('Adding webpack middleware...')
    createWebpackMiddleware.call(this)
    webpackWatchAndUpdate.call(this)
    watchPages.call(this)
  } else {
    debug('Building files...')
    yield [
      webpackRunClient.call(this),
      webpackRunServer.call(this)
    ]
    addAppTemplate.call(this)
  }
}

function addAppTemplate () {
  let templatePath = resolve(this.dir, '.nuxt', 'dist', 'index.html')
  if (fs.existsSync(templatePath)) {
    this.appTemplate = _.template(fs.readFileSync(templatePath, 'utf8'), {
      interpolate: /{{([\s\S]+?)}}/g
    })
  }
}

function * generateRoutesAndFiles () {
  debug('Generating routes...')
  // Layouts
  let layouts = {}
  const layoutsFiles = yield glob('layouts/*.vue', { cwd: this.srcDir })
  layoutsFiles.forEach((file) => {
    let name = file.split('/').slice(-1)[0].replace('.vue', '')
    if (name === 'error') return
    layouts[name] = r(this.srcDir, file)
  })
  const files = yield glob('pages/**/*.vue', { cwd: this.srcDir })
  // Interpret and move template files to .nuxt/
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
  this.options.store = fs.existsSync(join(this.srcDir, 'store'))
  let templateVars = {
    i18n: this.options.i18n,
    uniqBy: _.uniqBy,
    isDev: this.dev,
    router: {
      mode: this.options.router.mode,
      base: this.options.router.base,
      middleware: this.options.router.middleware,
      linkActiveClass: this.options.router.linkActiveClass,
      scrollBehavior: this.options.router.scrollBehavior
    },
    env: this.options.env,
    head: this.options.head,
    middleware: fs.existsSync(join(this.srcDir, 'middleware')),
    store: this.options.store,
    css: this.options.css,
    plugins: this.options.plugins.map((p) => {
      if (typeof p === 'string') {
        return { src: r(this.srcDir, p), ssr: true }
      }
      return { src: r(this.srcDir, p.src), ssr: !!p.ssr }
    }),
    appPath: './App.vue',
    layouts: layouts,
    loading: (typeof this.options.loading === 'string' ? r(this.srcDir, this.options.loading) : this.options.loading),
    transition: this.options.transition,
    components: {
      ErrorPage: null
    }
  }
  // Format routes for the lib/app/router.js template
  templateVars.router.routes = createRoutes(files, this.srcDir)
  if (typeof this.options.router.extendRoutes === 'function') {
    // let the user extend the routes
    this.options.router.extendRoutes(templateVars.router.routes, r)
  }
  // Routes for Generate command
  this.routes = flatRoutes(templateVars.router.routes)
  debug('Generating files...')
  if (layoutsFiles.includes('layouts/error.vue')) {
    templateVars.components.ErrorPage = r(this.srcDir, 'layouts/error.vue')
  }
  // If no default layout, create its folder and add the default folder
  if (!layouts.default) {
    yield mkdirp(r(this.dir, '.nuxt/layouts'))
    templatesFiles.push('layouts/default.vue')
    layouts.default = r(__dirname, 'app', 'layouts', 'default.vue')
  }
  // Add store if needed
  if (this.options.store) {
    templatesFiles.push('store.js')
  }
  let moveTemplates = templatesFiles.map((file) => {
    return readFile(r(__dirname, 'app', file), 'utf8')
    .then((fileContent) => {
      const template = _.template(fileContent, {
        imports: {
          serialize,
          hash
        }
      })
      const content = template(templateVars)
      const path = r(this.dir, '.nuxt', file)
      return writeFile(path, content, 'utf8')
      .then(() => {
        // Fix webpack loop (https://github.com/webpack/watchpack/issues/25#issuecomment-287789288)
        const dateFS = Date.now() / 1000 - 30
        return utimes(path, dateFS, dateFS)
      })
    })
  })
  yield moveTemplates
}

function createRoutes (files, srcDir) {
  let routes = []
  files.forEach((file) => {
    let keys = file.replace(/^pages/, '').replace(/\.vue$/, '').replace(/\/{2,}/g, '/').split('/').slice(1)
    let route = { name: '', path: '', component: r(srcDir, file) }
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
  const host = process.env.HOST || process.env.npm_package_config_nuxt_host || '127.0.0.1'
  const port = process.env.PORT || process.env.npm_package_config_nuxt_port || '3000'
  // setup on the fly compilation + hot-reload
  clientConfig.entry.app = _.flatten(['webpack-hot-middleware/client?reload=true', clientConfig.entry.app])
  clientConfig.plugins.push(
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new PostCompilePlugin(stats => {
      if (!stats.hasErrors() && !stats.hasWarnings()) {
        console.log(`> Open http://${host}:${port}\n`) // eslint-disable-line no-console
      }
    })
  )
  const clientCompiler = webpack(clientConfig)
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
  })
}

function webpackWatchAndUpdate () {
  const MFS = require('memory-fs') // <- dependencies of webpack
  const mfs = new MFS()
  const serverConfig = getWebpackServerConfig.call(this)
  const serverCompiler = webpack(serverConfig)
  const outputPath = join(serverConfig.output.path, 'server-bundle.json')
  serverCompiler.outputFileSystem = mfs
  this.webpackServerWatcher = serverCompiler.watch(this.options.watchers.webpack, (err) => {
    if (err) throw err
    createRenderer.call(this, JSON.parse(mfs.readFileSync(outputPath, 'utf-8')))
  })
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
      readFile(bundlePath, 'utf8')
      .then((bundle) => {
        createRenderer.call(this, JSON.parse(bundle))
        resolve()
      })
    })
  })
}

function createRenderer (bundle) {
  // Create bundle renderer to give a fresh context for every request
  let cacheConfig = false
  if (this.options.cache) {
    this.options.cache = (typeof this.options.cache !== 'object' ? {} : this.options.cache)
    cacheConfig = require('lru-cache')(_.defaults(this.options.cache, {
      max: 1000,
      maxAge: 1000 * 60 * 15
    }))
  }
  this.renderer = createBundleRenderer(bundle, {
    cache: cacheConfig
  })
  this.renderToString = pify(this.renderer.renderToString)
  this.renderToStream = this.renderer.renderToStream
}

function watchPages () {
  const patterns = [
    r(this.srcDir, 'pages'),
    r(this.srcDir, 'layouts'),
    r(this.srcDir, 'store'),
    r(this.srcDir, 'middleware'),
    r(this.srcDir, 'pages/*.vue'),
    r(this.srcDir, 'pages/**/*.vue'),
    r(this.srcDir, 'layouts/*.vue'),
    r(this.srcDir, 'layouts/**/*.vue')
  ]
  const options = Object.assign({}, this.options.watchers.chokidar, {
    ignoreInitial: true
  })
  /* istanbul ignore next */
  const refreshFiles = _.debounce(() => {
    co(generateRoutesAndFiles.bind(this))
  }, 200)
  this.pagesFilesWatcher = chokidar.watch(patterns, options)
  .on('add', refreshFiles)
  .on('unlink', refreshFiles)
}
