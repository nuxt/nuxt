'use strict'

const debug = require('debug')('nuxt:build')
import _ from 'lodash'
import co from 'co'
import chokidar from 'chokidar'
import fs from 'fs-extra'
import hash from 'hash-sum'
import pify from 'pify'
import webpack from 'webpack'
import serialize from 'serialize-javascript'
import { createBundleRenderer } from 'vue-server-renderer'
import { join, resolve, sep } from 'path'
import clientWebpackConfig from './webpack/client.config.js'
import serverWebpackConfig from './webpack/server.config.js'
import chalk from 'chalk'
import PostCompilePlugin from 'post-compile-webpack-plugin'
const remove = pify(fs.remove)
const readFile = pify(fs.readFile)
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
const webpackStats = {
  chunks: false,
  children: false,
  modules: false,
  colors: true
}
// force green color
debug.color = 2

const defaults = {
  analyze: false,
  publicPath: '/_nuxt/',
  filenames: {
    css: 'style.css',
    vendor: 'vendor.bundle.js',
    app: 'nuxt.bundle.js'
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
  if (this.options.build.publicPath.indexOf('http') === 0) {
    // activate only in production mode
    if (this.dev) {
      this.options.build.publicPath = defaults.publicPath
    } else {
      this.options.nuxtStatic = false
    }
  }
  // Production, create server-renderer
  if (!this.dev) {
    const serverConfig = getWebpackServerConfig.call(this)
    const bundlePath = join(serverConfig.output.path, serverConfig.output.filename)
    if (fs.existsSync(bundlePath)) {
      const bundle = fs.readFileSync(bundlePath, 'utf8')
      createRenderer.call(this, bundle)
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
  // Generate routes based on files
  const files = yield glob('pages/**/*.vue', { cwd: this.srcDir })
  this.routes = _.uniq(_.map(files, (file) => {
    return file.replace(/^pages/, '').replace(/\.vue$/, '').replace(/\/index/g, '').replace(/_/g, ':').replace('', '/').replace(/\/{2,}/g, '/')
  }))
  if (typeof this.options.router.extendRoutes === 'function') {
    // let the user extend the routes
    this.options.router.extendRoutes(this.routes)
  }
  // Interpret and move template files to .nuxt/
  debug('Generating files...')
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
  let templateVars = {
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
    middleware: this.options.middleware,
    store: this.options.store,
    css: this.options.css,
    plugins: this.options.plugins.map((p) => r(this.srcDir, p)),
    appPath: './App.vue',
    layouts: layouts,
    loading: (typeof this.options.loading === 'string' ? r(this.srcDir, this.options.loading) : this.options.loading),
    transition: this.options.transition,
    components: {
      ErrorPage: './nuxt-error.vue'
    }
  }
  // Format routes for the lib/app/router.js template
  templateVars.router.routes = createRoutes(files, this.srcDir)
  if (typeof this.options.router.extendRoutes === 'function') {
    // let the user extend the routes
    this.options.router.extendRoutes(templateVars.router.routes)
  }
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
      return writeFile(r(this.dir, '.nuxt', file), content, 'utf8')
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

function getWebpackClientConfig () {
  return clientWebpackConfig.call(this)
}

function getWebpackServerConfig () {
  return serverWebpackConfig.call(this)
}

function createWebpackMiddleware () {
  const clientConfig = getWebpackClientConfig.call(this)
  const host = process.env.HOST || '127.0.0.1'
  const port = process.env.PORT || '3000'
  // setup on the fly compilation + hot-reload
  clientConfig.entry.app = _.flatten(['webpack-hot-middleware/client?reload=true', clientConfig.entry.app])
  clientConfig.plugins.push(
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new PostCompilePlugin(stats => {
      process.stdout.write('\x1Bc')
      if (stats.hasErrors() || stats.hasWarnings()) {
        console.log(stats.toString('errors-only')) // eslint-disable-line no-console
        console.log() // eslint-disable-line no-console
        console.log(chalk.bgRed.black(' ERROR '), 'Compiling failed!') // eslint-disable-line no-console
      } else {
        console.log(stats.toString(webpackStats)) // eslint-disable-line no-console
        console.log(chalk.bold(`\n> Open http://${host}:${port}\n`)) // eslint-disable-line no-console
        console.log(chalk.bgGreen.black(' DONE '), 'Compiled successfully!') // eslint-disable-line no-console
      }
      console.log() // eslint-disable-line no-console
    })
  )
  const clientCompiler = webpack(clientConfig)
  // Add the middleware to the instance context
  this.webpackDevMiddleware = pify(require('webpack-dev-middleware')(clientCompiler, {
    publicPath: clientConfig.output.publicPath,
    stats: webpackStats,
    quiet: true,
    noInfo: true
  }))
  this.webpackHotMiddleware = pify(require('webpack-hot-middleware')(clientCompiler, {
    log: () => {}
  }))
}

function webpackWatchAndUpdate () {
  const MFS = require('memory-fs') // <- dependencies of webpack
  const mfs = new MFS()
  const serverConfig = getWebpackServerConfig.call(this)
  const serverCompiler = webpack(serverConfig)
  const outputPath = join(serverConfig.output.path, serverConfig.output.filename)
  serverCompiler.outputFileSystem = mfs
  this.webpackServerWatcher = serverCompiler.watch({}, (err) => {
    if (err) throw err
    createRenderer.call(this, mfs.readFileSync(outputPath, 'utf-8'))
  })
}

function webpackRunClient () {
  return new Promise((resolve, reject) => {
    const clientConfig = getWebpackClientConfig.call(this)
    const serverCompiler = webpack(clientConfig)
    serverCompiler.run((err, stats) => {
      if (err) return reject(err)
      console.log('[nuxt:build:client]\n', stats.toString(webpackStats)) // eslint-disable-line no-console
      if (stats.hasErrors()) return reject('Webpack build exited with errors')
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
      if (stats.hasErrors()) return reject('Webpack build exited with errors')
      const bundlePath = join(serverConfig.output.path, serverConfig.output.filename)
      readFile(bundlePath, 'utf8')
      .then((bundle) => {
        createRenderer.call(this, bundle)
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
    r(this.srcDir, 'pages/*.vue'),
    r(this.srcDir, 'pages/**/*.vue'),
    r(this.srcDir, 'layouts'),
    r(this.srcDir, 'layouts/*.vue'),
    r(this.srcDir, 'layouts/**/*.vue')
  ]
  const options = {
    ignoreInitial: true
  }
  /* istanbul ignore next */
  const refreshFiles = _.debounce(() => {
    var d = Date.now()
    co(generateRoutesAndFiles.bind(this))
    .then(() => {
      console.log('Time to gen:' + (Date.now() - d) + 'ms') // eslint-disable-line no-console
    })
  }, 200)
  this.pagesFilesWatcher = chokidar.watch(patterns, options)
  .on('add', refreshFiles)
  .on('unlink', refreshFiles)
}
