import path from 'path'
import fs from 'fs'

import _ from 'lodash'
import consola from 'consola'

import { isUrl, isPureObject } from '../common/utils'

import modes from './modes'
import defaults from './nuxt.config'

const Options = {}

export default Options

Options.from = function (_options) {
  // Clone options to prevent unwanted side-effects
  const options = Object.assign({}, _options)

  // Normalize options
  if (options.loading === true) {
    delete options.loading
  }
  if (
    options.router &&
    options.router.middleware &&
    !Array.isArray(options.router.middleware)
  ) {
    options.router.middleware = [options.router.middleware]
  }
  if (options.router && typeof options.router.base === 'string') {
    options._routerBaseSpecified = true
  }
  if (typeof options.transition === 'string') {
    options.transition = { name: options.transition }
  }
  if (typeof options.layoutTransition === 'string') {
    options.layoutTransition = { name: options.layoutTransition }
  }
  if (typeof options.extensions === 'string') {
    options.extensions = [options.extensions]
  }

  const hasValue = v => typeof v === 'string' && v
  options.rootDir = hasValue(options.rootDir) ? options.rootDir : process.cwd()

  // Apply defaults by ${buildDir}/dist/build.config.js
  // TODO: Unsafe operation.
  // const buildDir = options.buildDir || defaults.buildDir
  // const buildConfig = resolve(options.rootDir, buildDir, 'build.config.js')
  // if (existsSync(buildConfig)) {
  //   _.defaultsDeep(options, require(buildConfig))
  // }

  // Apply defaults
  _.defaultsDeep(options, defaults)

  // Resolve dirs
  options.srcDir = hasValue(options.srcDir)
    ? path.resolve(options.rootDir, options.srcDir)
    : options.rootDir
  options.buildDir = path.resolve(options.rootDir, options.buildDir)

  // Populate modulesDir
  options.modulesDir = []
    .concat(options.modulesDir)
    .concat(path.join(options.nuxtDir, 'node_modules'))
    .filter(dir => hasValue(dir))
    .map(dir => path.resolve(options.rootDir, dir))

  // Sanitize extensions
  if (options.extensions.indexOf('js') === -1) {
    options.extensions.unshift('js')
  }

  if (options.extensions.indexOf('mjs') === -1) {
    options.extensions.unshift('mjs')
  }

  // If app.html is defined, set the template path to the user template
  options.appTemplatePath = path.resolve(options.buildDir, 'views/app.template.html')
  if (fs.existsSync(path.join(options.srcDir, 'app.html'))) {
    options.appTemplatePath = path.join(options.srcDir, 'app.html')
  }

  // Ignore publicPath on dev
  /* istanbul ignore if */
  if (options.dev && isUrl(options.build.publicPath)) {
    options.build.publicPath = defaults.build.publicPath
  }

  // If store defined, update store options to true unless explicitly disabled
  if (
    options.store !== false &&
    fs.existsSync(path.join(options.srcDir, options.dir.store)) &&
    fs.readdirSync(path.join(options.srcDir, options.dir.store))
      .find(filename => filename !== 'README.md' && filename[0] !== '.')
  ) {
    options.store = true
  }

  // Set the name for global variables - should contain only letters
  options.globalName = (_.isString(options.globalName) && /^[a-zA-Z]+$/.test(options.globalName))
    ? options.globalName.toLowerCase()
    : 'nuxt'

  // SPA loadingIndicator
  if (options.loadingIndicator) {
    // Normalize loadingIndicator
    if (!isPureObject(options.loadingIndicator)) {
      options.loadingIndicator = { name: options.loadingIndicator }
    }

    // Apply defaults
    options.loadingIndicator = Object.assign(
      {
        name: 'default',
        color: (options.loading && options.loading.color) || '#D3D3D3',
        color2: '#F5F5F5',
        background: (options.manifest && options.manifest.theme_color) || 'white',
        dev: options.dev,
        loading: options.messages.loading
      },
      options.loadingIndicator
    )
  }

  // Debug errors
  if (options.debug === undefined) {
    options.debug = options.dev
  }

  // Apply default hash to CSP option
  const csp = options.render.csp
  const cspDefaults = {
    hashAlgorithm: 'sha256',
    allowedSources: undefined,
    policies: undefined
  }
  if (csp) {
    options.render.csp = _.defaults(_.isObject(csp) ? csp : {}, cspDefaults)
  }

  // cssSourceMap
  if (options.build.cssSourceMap === undefined) {
    options.build.cssSourceMap = options.dev
  }

  // babel cacheDirectory
  if (options.build.babel.cacheDirectory === undefined) {
    options.build.babel.cacheDirectory = options.dev
  }

  // Normalize ignore
  options.ignore = options.ignore ? [].concat(options.ignore) : []

  // Append ignorePrefix glob to ignore
  if (typeof options.ignorePrefix === 'string') {
    options.ignore.push(`**/${options.ignorePrefix}*.*`)
  }

  // Apply mode preset
  const modePreset = modes[options.mode || 'universal'] || modes['universal']
  _.defaultsDeep(options, modePreset)

  // If no server-side rendering, add appear true transition
  /* istanbul ignore if */
  if (options.render.ssr === false && options.transition) {
    options.transition.appear = true
  }

  // We assume the SPA fallback path is 404.html (for GitHub Pages, Surge, etc.)
  if (options.generate.fallback === true) {
    options.generate.fallback = '404.html'
  }

  // Enable [name] when analyze or dev mode
  if (options.build.optimization.splitChunks.name === undefined &&
    (options.dev || options.build.analyze)) {
    options.build.optimization.splitChunks.name = true
  }

  if (options.build.stats === 'none') {
    options.build.stats = false
  }

  // Vendor backward compatibility with nuxt 1.x
  if (typeof options.build.vendor !== 'undefined') {
    delete options.build.vendor
    consola.warn('vendor has been deprecated due to webpack4 optimization')
  }

  // TODO: remove when mini-css-extract-plugin supports HMR
  if (options.dev) {
    options.build.extractCSS = false
  }

  // include SFCs in node_modules
  options.build.transpile = [/\.vue\.js/].concat(options.build.transpile || [])

  return options
}
