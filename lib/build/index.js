'use strict'

const debug = require('debug')('nuxt:build')
const _ = require('lodash')
const del = require('del')
const fs = require('fs')
const glob = require('glob-promise')
const hash = require('hash-sum')
const mkdirp = require('mkdirp-then')
const pify = require('pify')
const webpack = require('webpack')
const { createBundleRenderer } = require('vue-server-renderer')
const { join, resolve } = require('path')
const r = resolve

module.exports = function * () {
  /*
  ** Check if pages dir exists and warn if not
  */
  if (!fs.existsSync(join(this.dir, 'pages'))) {
    if (fs.existsSync(join(this.dir, '..', 'pages'))) {
      console.error('> No `pages` directory found. Did you mean to run `next` in the parent (`../`) directory?')
    } else {
      console.error('> Couldn\'t find a `pages` directory. Please create one under the project root')
    }
    process.exit()
  }
  if (this.options.store && !fs.existsSync(join(this.dir, 'store'))) {
    console.error('> No `store` directory found (store option activated). Please create on under the project root')
    process.exit()
  }
  if (this.options.store && !fs.existsSync(join(this.dir, 'store', 'index.js'))) {
    console.error('> No `store/index.js` file found (store option activated). Please create the file.')
    process.exit()
  }
  debug(`App root: ${this.dir}`)
  debug('Generating .nuxt/ files...')
  /*
  ** Create .nuxt/, .nuxt/components and .nuxt/dist folders
  */
  yield del(r(this.dir, '.nuxt'), { force: process.env.NODE_ENV === 'test' })
  yield mkdirp(r(this.dir, '.nuxt/components'))
  if (this.isProd) {
    yield mkdirp(r(this.dir, '.nuxt/dist'))
  }
  /*
  ** Generate routes based on files
  */
  const files = yield glob('pages/**/*.vue', { cwd: this.dir })
  let routes = []
  files.forEach((file) => {
    let path = file.replace(/^pages/, '').replace(/index\.vue$/, '/').replace(/\.vue$/, '').replace(/\/{2,}/g, '/')
    if (path[1] === '_') return
    routes.push({ path: path, component: file })
  })
  this.options.routes.forEach((route) => {
    route.component = r(this.dir, route.component)
  })
  this.options.routes = routes.concat(this.options.routes)
  // TODO: check .children
  this.options.routes.forEach((route) => {
    route._component = r(this.dir, route.component)
    route._name = '_' + hash(route._component)
    route.component = route._name
  })
  /*
  ** Interpret and move template files to .nuxt/
  */
  let templatesFiles = [
    'App.vue',
    'client.js',
    'index.js',
    'router.js',
    'server.js',
    'utils.js',
    'components/Loading.vue'
  ]
  let templateVars = {
    isDev: this.isDev,
    store: this.options.store,
    loading: (this.options.loading === 'string' ? r(this.dir, this.options.loading) : this.options.loading),
    components: {
      Loading: r(__dirname, '..', 'app', 'components', 'Loading.vue'),
      ErrorPage: r(__dirname, '..', '..', 'pages', (this.isDev ? '_error-debug.vue' : '_error.vue'))
    },
    routes: this.options.routes
  }
  if (this.options.store) {
    templateVars.storePath = r(this.dir, 'store')
  }
  if (this.isDev && files.includes('pages/_error-debug.vue')) {
    templateVars.components.ErrorPage = r(this.dir, 'pages/_error-debug.vue')
  }
  if (!this.isDev && files.includes('pages/_error.vue')) {
    templateVars.components.ErrorPage = r(this.dir, 'pages/_error.vue')
  }
  const readFile = pify(fs.readFile)
  const writeFile = pify(fs.writeFile)
  let moveTemplates = templatesFiles.map((file) => {
    return readFile(r(__dirname, '..', 'app', file), 'utf8')
    .then((fileContent) => {
      const template = _.template(fileContent)
      const content = template(templateVars)
      return writeFile(r(this.dir, '.nuxt', file), content, 'utf8')
    })
  })
  yield moveTemplates
  debug('Files moved!')
  /*
  ** Generate .nuxt/dist/ files
  */
  if (this.isDev) {
    debug('Adding webpack middlewares...')
    createWebpackMiddlewares.call(this)
    webpackWatchAndUpdate.call(this)
  } else {
    debug('Building files...')
    yield [
      webpackRunClient.call(this),
      webpackRunServer.call(this)
    ]
  }
  return this
}

function addGlobalWebpackConfig (config) {
  const nodeModulesDir = join(__dirname, '..', '..', 'node_modules')
  config.resolve = {
    modules: [
      nodeModulesDir,
      join(this.dir, 'node_modules')
    ]
  }
  config.resolveLoader = {
    modules: [
      nodeModulesDir,
      join(this.dir, 'node_modules')
    ]
  }
  return config
}

function getWebpackClientConfig () {
  var config = require(r(__dirname, 'webpack', 'client.config.js'))
  // Entry
  config.entry.app = r(this.dir, '.nuxt', 'client.js')
  // Add vendors
  if (this.options.store) config.entry.vendor.push('vuex')
  config.entry.vendor = config.entry.vendor.concat(this.options.vendor)
  // extract vendor chunks for better caching
  config.plugins.push(
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      filename: this.options.filenames.vendor
    })
  )
  // Output
  config.output.path = r(this.dir, '.nuxt', 'dist')
  config.output.filename = this.options.filenames.app
  // Extract text plugin
  if (this.isProd) {
    const ExtractTextPlugin = require('extract-text-webpack-plugin')
    let plugin = config.plugins.find((plugin) => plugin instanceof ExtractTextPlugin)
    if (plugin) plugin.filename = this.options.filenames.css
  }
  return addGlobalWebpackConfig.call(this, config)
}

function getWebpackServerConfig () {
  var config = require(r(__dirname, 'webpack', 'server.config.js'))
  // Entry
  config.entry = r(this.dir, '.nuxt', 'server.js')
  // Output
  config.output.path = r(this.dir, '.nuxt', 'dist')
  // Externals
  config.externals = Object.keys(require(r(__dirname, '..', '..', 'package.json')).dependencies || {})
  const projectPackageJson = r(this.dir, 'package.json')
  if (fs.existsSync(projectPackageJson)) {
    config.externals = config.externals.concat(Object.keys(require(r(this.dir, 'package.json')).dependencies || {}))
  }
  config.externals = _.uniq(config.externals)
  return addGlobalWebpackConfig.call(this, config)
}

function createWebpackMiddlewares () {
  const clientConfig = getWebpackClientConfig.call(this)
  // setup on the fly compilation + hot-reload
  clientConfig.entry.app = ['webpack-hot-middleware/client', clientConfig.entry.app]
  clientConfig.plugins.push(
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin()
  )
  const clientCompiler = webpack(clientConfig)
  // Add the middlewares to the instance context
  this.webpackDevMiddleware = pify(require('webpack-dev-middleware')(clientCompiler, {
    publicPath: clientConfig.output.publicPath,
    stats: {
      colors: true,
      chunks: false
    },
    quiet: true,
    noInfo: true
  }))
  this.webpackHotMiddleware = pify(require('webpack-hot-middleware')(clientCompiler))
}

function webpackWatchAndUpdate () {
  const MFS = require('memory-fs') // <- dependencies of webpack
  const mfs = new MFS()
  const serverConfig = getWebpackServerConfig.call(this)
  const serverCompiler = webpack(serverConfig)
  const outputPath = join(serverConfig.output.path, serverConfig.output.filename)
  serverCompiler.outputFileSystem = mfs
  this.webpackServerWatcher = serverCompiler.watch({}, (err, stats) => {
    if (err) throw err
    stats = stats.toJson()
    stats.errors.forEach(err => console.error(err))
    stats.warnings.forEach(err => console.warn(err))
    createRenderer.call(this, mfs.readFileSync(outputPath, 'utf-8'))
  })
}

function webpackRunClient () {
  return new Promise((resolve, reject) => {
    const clientConfig = getWebpackClientConfig.call(this)
    const serverCompiler = webpack(clientConfig)
    serverCompiler.run((err, stats) => {
      if (err) return reject(err)
      debug('[webpack:build:client]\n', stats.toString({ chunks: false, colors: true }))
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
      debug('[webpack:build:server]\n', stats.toString({ chunks: false, colors: true }))
      const bundlePath = join(serverConfig.output.path, serverConfig.output.filename)
      createRenderer.call(this, fs.readFileSync(bundlePath, 'utf8'))
      resolve()
    })
  })
}

function createRenderer (bundle) {
  process.env.VUE_ENV = (process.env.VUE_ENV ? process.env.VUE_ENV : 'server')
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
