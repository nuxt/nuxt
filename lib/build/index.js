'use strict'

const debug = require('debug')('nuxt:build')
const _ = require('lodash')
const co = require('co')
const chokidar = require('chokidar')
const fs = require('fs-extra')
const glob = require('glob-promise')
const hash = require('hash-sum')
const pify = require('pify')
const webpack = require('webpack')
const { createBundleRenderer } = require('vue-server-renderer')
const { join, resolve } = require('path')
const remove = pify(fs.remove)
const readFile = pify(fs.readFile)
const writeFile = pify(fs.writeFile)
const mkdirp = pify(fs.mkdirp)
const r = resolve

const defaults = {
  filenames: {
    css: 'style.css',
    vendor: 'vendor.bundle.js',
    app: 'nuxt.bundle.js'
  },
  vendor: [],
  loaders: []
}
const defaultsLoaders = [
  {
    test: /\.(png|jpg|gif|svg)$/,
    loader: 'url-loader',
    query: {
      limit: 1000, // 1KO
      name: 'img/[name].[ext]?[hash]'
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

module.exports = function * () {
  // Defaults build options
  if (this.options.build && Array.isArray(this.options.build.loaders)) {
    this.options.build = _.defaultsDeep(this.options.build, defaults)
  } else {
    this.options.build = _.defaultsDeep(this.options.build, defaults, { loaders: defaultsLoaders })
  }
  if (!this.options._build && !this.options._renderer) {
    return Promise.resolve()
  }
  if (!this.options._build) {
    const serverConfig = getWebpackServerConfig.call(this)
    const bundlePath = join(serverConfig.output.path, serverConfig.output.filename)
    if (!fs.existsSync(bundlePath)) {
      console.error('> No build files found, please run `nuxt build` before launching `nuxt start`')
      process.exit(1)
    }
    const bundle = yield readFile(bundlePath, 'utf8')
    createRenderer.call(this, bundle)
    return Promise.resolve()
  }
  /*
  ** Check if pages dir exists and warn if not
  */
  if (!fs.existsSync(join(this.dir, 'pages'))) {
    if (fs.existsSync(join(this.dir, '..', 'pages'))) {
      console.error('> No `pages` directory found. Did you mean to run `nuxt` in the parent (`../`) directory?')
    } else {
      console.error('> Couldn\'t find a `pages` directory. Please create one under the project root')
    }
    process.exit(1)
  }
  if (this.options.store && !fs.existsSync(join(this.dir, 'store'))) {
    console.error('> No `store` directory found (store option activated). Please create on under the project root')
    process.exit(1)
  }
  if (this.options.store && !fs.existsSync(join(this.dir, 'store', 'index.js'))) {
    console.error('> No `store/index.js` file found (store option activated). Please create the file.')
    process.exit(1)
  }
  debug(`App root: ${this.dir}`)
  debug('Generating .nuxt/ files...')
  /*
  ** Create .nuxt/, .nuxt/components and .nuxt/dist folders
  */
  yield remove(r(this.dir, '.nuxt'))
  yield mkdirp(r(this.dir, '.nuxt/components'))
  if (!this.dev) {
    yield mkdirp(r(this.dir, '.nuxt/dist'))
  }
  // Resolve custom routes component path
  this.options.router.routes.forEach((route) => {
    if (route.component.slice(-4) !== '.vue') {
      route.component = route.component + '.vue'
    }
    // If not using an alias
    if (route.component.indexOf('~') === -1) {
      route.component = r(this.dir, route.component)
    }
  })
  // Generate routes and interpret the template files
  yield generateRoutesAndFiles.call(this)
  /*
  ** Generate .nuxt/dist/ files
  */
  if (this.dev) {
    debug('Adding webpack middlewares...')
    createWebpackMiddlewares.call(this)
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
  /*
  ** Generate routes based on files
  */
  const files = yield glob('pages/**/*.vue', { cwd: this.dir })
  let routes = []
  files.forEach((file) => {
    let path = file.replace(/^pages/, '').replace(/index\.vue$/, '/').replace(/\.vue$/, '').replace(/\/{2,}/g, '/')
    if (path[1] === '_') return
    routes.push({ path: path, component: r(this.dir, file) })
  })
  // Concat pages routes and custom routes in this.routes
  this.routes = routes.concat(this.options.router.routes)
  /*
  ** Interpret and move template files to .nuxt/
  */
  debug('Generating files...')
  let templatesFiles = [
    'App.vue',
    'client.js',
    'index.js',
    'router.js',
    'server.js',
    'utils.js',
    'components/nuxt-loading.vue'
  ]
  let templateVars = {
    isDev: this.dev,
    router: {
      base: this.options.router.base,
      linkActiveClass: this.options.router.linkActiveClass,
      routes: this.routes
    },
    head: this.options.head,
    store: this.options.store,
    css: this.options.css,
    plugins: this.options.plugins.map((p) => r(this.dir, p)),
    loading: (typeof this.options.loading === 'string' ? r(this.dir, this.options.loading) : this.options.loading),
    components: {
      Loading: r(__dirname, '..', 'app', 'components', 'nuxt-loading.vue'),
      ErrorPage: r(__dirname, '..', 'app', 'components', (this.dev ? 'nuxt-error-debug.vue' : 'nuxt-error.vue'))
    }
  }
  if (templateVars.loading === 'string' && templateVars.loading.slice(-4) !== '.vue') {
    templateVars.loading = templateVars.loading + '.vue'
  }
  // Format routes for the lib/app/router.js template
  // TODO: check .children
  templateVars.router.routes.forEach((route) => {
    route._component = route.component
    route._name = '_' + hash(route._component)
    route.component = route._name
  })
  if (this.dev && files.includes('pages/_error-debug.vue')) {
    templateVars.components.ErrorPage = r(this.dir, 'pages/_error-debug.vue')
  }
  if (!this.dev && files.includes('pages/_error.vue')) {
    templateVars.components.ErrorPage = r(this.dir, 'pages/_error.vue')
  }
  let moveTemplates = templatesFiles.map((file) => {
    return readFile(r(__dirname, '..', 'app', file), 'utf8')
    .then((fileContent) => {
      const template = _.template(fileContent)
      const content = template(templateVars)
      return writeFile(r(this.dir, '.nuxt', file), content, 'utf8')
    })
  })
  yield moveTemplates
}

function getWebpackClientConfig () {
  const clientConfigPath = r(__dirname, 'webpack', 'client.config.js')
  return require(clientConfigPath).call(this)
}

function getWebpackServerConfig () {
  const configServerPath = r(__dirname, 'webpack', 'server.config.js')
  return require(configServerPath).call(this)
}

function createWebpackMiddlewares () {
  const clientConfig = getWebpackClientConfig.call(this)
  // setup on the fly compilation + hot-reload
  clientConfig.entry.app = ['webpack-hot-middleware/client?reload=true', clientConfig.entry.app]
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
    quiet: false,
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
      console.log('[nuxt:build:client]\n', stats.toString({ chunks: false, colors: true }))
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
      console.log('[nuxt:build:server]\n', stats.toString({ chunks: false, colors: true }))
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

function watchPages () {
  const patterns = [ r(this.dir, 'pages/*.vue'), r(this.dir, 'pages/**/*.vue') ]
  const options = {
    ignored: '**/_*.vue',
    ignoreInitial: true
  }
  const refreshFiles = _.debounce(() => {
    console.log('Reload files', this.routes.length)
    var d = Date.now()
    co(generateRoutesAndFiles.bind(this))
    .then(() => {
      console.log('Time to gen:' + (Date.now() - d) + 'ms')
    })
  }, 200)
  this.pagesFilesWatcher = chokidar.watch(patterns, options)
  .on('add', refreshFiles)
  .on('unlink', refreshFiles)
}
