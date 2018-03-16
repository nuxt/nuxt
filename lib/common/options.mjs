import _ from 'lodash'
import Debug from 'debug'
import path from 'path'
import fs from 'fs'

import { isUrl, isPureObject } from '../common/utils'

import modes from './modes'
import defaults from './nuxt.config'

const debug = Debug('nuxt:build')
debug.color = 2 // Force green color

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
  options.cacheDir = path.resolve(options.rootDir, options.cacheDir)

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

  // Normalize loadingIndicator
  if (!isPureObject(options.loadingIndicator)) {
    options.loadingIndicator = { name: options.loadingIndicator }
  }

  // Apply default hash to CSP option
  if (options.render.csp === true) {
    options.render.csp = { hashAlgorithm: 'sha256' }
  }

  // Apply defaults to loadingIndicator
  options.loadingIndicator = Object.assign(
    {
      name: 'pulse',
      color: '#dbe1ec',
      background: 'white'
    },
    options.loadingIndicator
  )

  // cssSourceMap
  if (options.build.cssSourceMap === undefined) {
    options.build.cssSourceMap = options.dev
  }

  // babel cacheDirectory
  if (options.build.babel.cacheDirectory === undefined) {
    options.build.babel.cacheDirectory = options.dev
  }

  // Debug errors
  if (options.debug === undefined) {
    options.debug = options.dev
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

  return options
}
