import path from 'path'
import fs from 'fs'
import defaultsDeep from 'lodash/defaultsDeep'
import defu from 'defu'
import pick from 'lodash/pick'
import uniq from 'lodash/uniq'
import consola from 'consola'
import destr from 'destr'
import { TARGETS, MODES, guardDir, isNonEmptyString, isPureObject, isUrl, getMainModule, urlJoin, getPKG } from 'nuxt/utils'
import { defaultNuxtConfigFile, getDefaultNuxtConfig } from './config'

export function getNuxtConfig (_options) {
  // Prevent duplicate calls
  if (_options.__normalized__) {
    return _options
  }

  // Clone options to prevent unwanted side-effects
  const options = Object.assign({}, _options)
  options.__normalized__ = true

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

  // TODO: Remove for Nuxt 3
  // router.scrollBehavior -> app/router.scrollBehavior.js
  if (options.router && typeof options.router.scrollBehavior !== 'undefined') {
    consola.warn('`router.scrollBehavior` property is deprecated in favor of using `~/app/router.scrollBehavior.js` file, learn more: https://nuxtjs.org/api/configuration-router#scrollbehavior')
  }

  // TODO: Remove for Nuxt 3
  // transition -> pageTransition
  if (typeof options.transition !== 'undefined') {
    consola.warn('`transition` property is deprecated in favor of `pageTransition` and will be removed in Nuxt 3')
    options.pageTransition = options.transition
    delete options.transition
  }

  if (typeof options.pageTransition === 'string') {
    options.pageTransition = { name: options.pageTransition }
  }

  if (typeof options.layoutTransition === 'string') {
    options.layoutTransition = { name: options.layoutTransition }
  }

  if (typeof options.extensions === 'string') {
    options.extensions = [options.extensions]
  }

  options.globalName = (isNonEmptyString(options.globalName) && /^[a-zA-Z]+$/.test(options.globalName))
    ? options.globalName.toLowerCase()
    // use `` for preventing replacing to nuxt-edge
    : 'nuxt'

  // Resolve rootDir
  options.rootDir = isNonEmptyString(options.rootDir) ? path.resolve(options.rootDir) : process.cwd()

  // Apply defaults by ${buildDir}/dist/build.config.js
  // TODO: Unsafe operation.
  // const buildDir = options.buildDir || defaults.buildDir
  // const buildConfig = resolve(options.rootDir, buildDir, 'build.config.js')
  // if (existsSync(buildConfig)) {
  //   defaultsDeep(options, require(buildConfig))
  // }

  // Apply defaults
  const nuxtConfig = getDefaultNuxtConfig()

  nuxtConfig.build._publicPath = nuxtConfig.build.publicPath

  // Fall back to default if publicPath is falsy
  if (options.build && !options.build.publicPath) {
    options.build.publicPath = undefined
  }

  defaultsDeep(options, nuxtConfig)

  // Target
  options.target = options.target || 'server'
  if (!Object.values(TARGETS).includes(options.target)) {
    consola.warn(`Unknown target: ${options.target}. Falling back to server`)
    options.target = 'server'
  }

  // SSR root option
  if (options.ssr === false) {
    options.mode = MODES.spa
  }

  // Apply mode preset
  const modePreset = options.modes[options.mode || MODES.universal]

  if (!modePreset) {
    consola.warn(`Unknown mode: ${options.mode}. Falling back to ${MODES.universal}`)
  }
  defaultsDeep(options, modePreset || options.modes[MODES.universal])

  // Sanitize router.base
  if (!/\/$/.test(options.router.base)) {
    options.router.base += '/'
  }

  // Alias export to generate
  // TODO: switch to export by default for nuxt3
  if (options.export) {
    options.generate = defu(options.export, options.generate)
  }
  exports.export = options.generate

  // Check srcDir and generate.dir existence
  const hasSrcDir = isNonEmptyString(options.srcDir)
  const hasGenerateDir = isNonEmptyString(options.generate.dir)

  // Resolve srcDir
  options.srcDir = hasSrcDir
    ? path.resolve(options.rootDir, options.srcDir)
    : options.rootDir

  // Resolve buildDir
  options.buildDir = path.resolve(options.rootDir, options.buildDir)

  // Aliases
  const { rootDir, srcDir, dir: { assets: assetsDir, static: staticDir } } = options
  options.alias = {
    '~~': rootDir,
    '@@': rootDir,
    '~': srcDir,
    '@': srcDir,
    [assetsDir]: path.join(srcDir, assetsDir),
    [staticDir]: path.join(srcDir, staticDir),
    ...options.alias
  }

  // Default value for _nuxtConfigFile
  if (!options._nuxtConfigFile) {
    options._nuxtConfigFile = path.resolve(options.rootDir, `${defaultNuxtConfigFile}.js`)
  }

  if (!options._nuxtConfigFiles) {
    options._nuxtConfigFiles = [
      options._nuxtConfigFile
    ]
  }

  // Watch for config file changes
  options.watch.push(...options._nuxtConfigFiles)

  // Protect rootDir against buildDir
  guardDir(options, 'rootDir', 'buildDir')

  if (hasGenerateDir) {
    // Resolve generate.dir
    options.generate.dir = path.resolve(options.rootDir, options.generate.dir)

    // Protect rootDir against buildDir
    guardDir(options, 'rootDir', 'generate.dir')
  }

  if (hasSrcDir) {
    // Protect srcDir against buildDir
    guardDir(options, 'srcDir', 'buildDir')

    if (hasGenerateDir) {
      // Protect srcDir against generate.dir
      guardDir(options, 'srcDir', 'generate.dir')
    }
  }

  // Populate modulesDir
  options.modulesDir = uniq(
    getMainModule().paths.concat(
      [].concat(options.modulesDir).map(dir => path.resolve(options.rootDir, dir))
    )
  )

  const mandatoryExtensions = ['js', 'mjs']

  options.extensions = mandatoryExtensions
    .filter(ext => !options.extensions.includes(ext))
    .concat(options.extensions)

  // If app.html is defined, set the template path to the user template
  if (options.appTemplatePath === undefined) {
    options.appTemplatePath = path.resolve(options.buildDir, 'views/app.template.html')
    if (fs.existsSync(path.join(options.srcDir, 'app.html'))) {
      options.appTemplatePath = path.join(options.srcDir, 'app.html')
    }
  } else {
    options.appTemplatePath = path.resolve(options.srcDir, options.appTemplatePath)
  }

  options.build.publicPath = options.build.publicPath.replace(/([^/])$/, '$1/')
  options.build._publicPath = options.build._publicPath.replace(/([^/])$/, '$1/')

  // Ignore publicPath on dev
  if (options.dev && isUrl(options.build.publicPath)) {
    options.build.publicPath = options.build._publicPath
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

  // Validate that etag.hash is a function, if not unset it
  if (options.render.etag) {
    const { hash } = options.render.etag
    if (hash) {
      const isFn = typeof hash === 'function'
      if (!isFn) {
        options.render.etag.hash = undefined

        if (options.dev) {
          consola.warn(`render.etag.hash should be a function, received ${typeof hash} instead`)
        }
      }
    }
  }

  // Apply default hash to CSP option
  if (options.render.csp) {
    options.render.csp = defu(options.render.csp, {
      hashAlgorithm: 'sha256',
      allowedSources: undefined,
      policies: undefined,
      addMeta: Boolean(options.target === TARGETS.static),
      unsafeInlineCompatibility: false,
      reportOnly: options.debug
    })

    // TODO: Remove this if statement in Nuxt 3, we will stop supporting this typo (more on: https://github.com/nuxt/nuxt.js/pull/6583)
    if (options.render.csp.unsafeInlineCompatiblity) {
      consola.warn('Using `unsafeInlineCompatiblity` is deprecated and will be removed in Nuxt 3. Use `unsafeInlineCompatibility` instead.')
      options.render.csp.unsafeInlineCompatibility = options.render.csp.unsafeInlineCompatiblity
      delete options.render.csp.unsafeInlineCompatiblity
    }
  }

  // cssSourceMap
  if (options.build.cssSourceMap === undefined) {
    options.build.cssSourceMap = options.dev
  }

  const babelConfig = options.build.babel
  // babel cacheDirectory
  if (babelConfig.cacheDirectory === undefined) {
    babelConfig.cacheDirectory = options.dev
  }

  // TODO: remove this warn in Nuxt 3
  if (Array.isArray(babelConfig.presets)) {
    const warnPreset = (presetName) => {
      const oldPreset = '@nuxtjs/babel-preset-app'
      const newPreset = '@nuxt/babel-preset-app'
      if (presetName.includes(oldPreset)) {
        presetName = presetName.replace(oldPreset, newPreset)
        consola.warn('@nuxtjs/babel-preset-app has been deprecated, please use @nuxt/babel-preset-app.')
      }
      return presetName
    }
    babelConfig.presets = babelConfig.presets.map((preset) => {
      const hasOptions = Array.isArray(preset)
      if (hasOptions) {
        preset[0] = warnPreset(preset[0])
      } else if (typeof preset === 'string') {
        preset = warnPreset(preset)
      }
      return preset
    })
  }

  // Vue config
  const vueConfig = options.vue.config

  if (vueConfig.silent === undefined) {
    vueConfig.silent = !options.dev
  }
  if (vueConfig.performance === undefined) {
    vueConfig.performance = options.dev
  }

  // merge custom env with variables
  const eligibleEnvVariables = pick(process.env, Object.keys(process.env).filter(k => k.startsWith('NUXT_ENV_')))
  Object.assign(options.env, eligibleEnvVariables)

  // Normalize ignore
  options.ignore = options.ignore ? [].concat(options.ignore) : []

  // Append ignorePrefix glob to ignore
  if (typeof options.ignorePrefix === 'string') {
    options.ignore.push(`**/${options.ignorePrefix}*.*`)
  }

  // Compression middleware legacy
  if (options.render.gzip) {
    consola.warn('render.gzip is deprecated and will be removed in a future version! Please switch to render.compressor')
    options.render.compressor = options.render.gzip
    delete options.render.gzip
  }

  // If no server-side rendering, add appear true transition
  if (options.render.ssr === false && options.pageTransition) {
    options.pageTransition.appear = true
  }

  options.render.ssrLog = options.dev
    ? options.render.ssrLog === undefined || options.render.ssrLog
    : false

  // We assume the SPA fallback path is 404.html (for GitHub Pages, Surge, etc.)
  if (options.generate.fallback === true) {
    options.generate.fallback = '404.html'
  }

  if (options.build.stats === 'none' || options.build.quiet === true) {
    options.build.stats = false
  }

  // Vendor backward compatibility with nuxt 1.x
  if (typeof options.build.vendor !== 'undefined') {
    delete options.build.vendor
    consola.warn('vendor has been deprecated due to webpack4 optimization')
  }

  // Disable CSS extraction due to incompatibility with thread-loader
  if (options.build.extractCSS && options.build.parallel) {
    options.build.parallel = false
    consola.warn('extractCSS cannot work with parallel build due to limited work pool in thread-loader')
  }

  // build.extractCSS.allChunks has no effect
  if (typeof options.build.extractCSS.allChunks !== 'undefined') {
    consola.warn('build.extractCSS.allChunks has no effect from v2.0.0. Please use build.optimization.splitChunks settings instead.')
  }

  // devModules has been renamed to buildModules
  if (typeof options.devModules !== 'undefined') {
    consola.warn('`devModules` has been renamed to `buildModules` and will be removed in Nuxt 3.')
    options.buildModules.push(...options.devModules)
    delete options.devModules
  }

  // Enable minimize for production builds
  if (options.build.optimization.minimize === undefined) {
    options.build.optimization.minimize = !options.dev
  }

  // Enable optimizeCSS only when extractCSS is enabled
  if (options.build.optimizeCSS === undefined) {
    options.build.optimizeCSS = options.build.extractCSS ? {} : false
  }

  const { loaders } = options.build
  const vueLoader = loaders.vue
  if (vueLoader.productionMode === undefined) {
    vueLoader.productionMode = !options.dev
  }
  const styleLoaders = [
    'css', 'cssModules', 'less',
    'sass', 'scss', 'stylus', 'vueStyle'
  ]
  for (const name of styleLoaders) {
    const loader = loaders[name]
    if (loader && loader.sourceMap === undefined) {
      loader.sourceMap = Boolean(options.build.cssSourceMap)
    }
  }

  options.build.transpile = [].concat(options.build.transpile || [])

  if (options.build.quiet === true) {
    consola.level = 0
  }

  // Use runInNewContext for dev mode by default
  const { bundleRenderer } = options.render
  if (typeof bundleRenderer.runInNewContext === 'undefined') {
    bundleRenderer.runInNewContext = options.dev
  }

  // TODO: Remove this if statement in Nuxt 3
  if (options.build.crossorigin) {
    consola.warn('Using `build.crossorigin` is deprecated and will be removed in Nuxt 3. Please use `render.crossorigin` instead.')
    options.render.crossorigin = options.build.crossorigin
    delete options.build.crossorigin
  }

  const { timing } = options.server
  if (timing) {
    options.server.timing = { total: true, ...timing }
  }

  if (isPureObject(options.serverMiddleware)) {
    options.serverMiddleware = Object.entries(options.serverMiddleware)
      .map(([path, handler]) => ({ path, handler }))
  }

  // Generate staticAssets
  const { staticAssets } = options.generate
  if (!staticAssets.version) {
    staticAssets.version = String(Math.round(Date.now() / 1000))
  }
  if (!staticAssets.base) {
    const publicPath = isUrl(options.build.publicPath) ? '' : options.build.publicPath // "/_nuxt" or custom CDN URL
    staticAssets.base = urlJoin(publicPath, staticAssets.dir)
  }
  if (!staticAssets.versionBase) {
    staticAssets.versionBase = urlJoin(staticAssets.base, staticAssets.version)
  }

  // createRequire factory
  if (options.createRequire === undefined) {
    const createRequire = require('create-require')
    options.createRequire = module => createRequire(module.filename)
  }

  // ----- Builtin modules -----

  // Loading screen
  // Force disable for production and programmatic users
  if (!options.dev || !options._cli || !getPKG('@nuxt/loading-screen')) {
    options.build.loadingScreen = false
  }
  if (options.build.loadingScreen) {
    options._modules.push(['@nuxt/loading-screen', options.build.loadingScreen])
  } else {
    // When loadingScreen is disabled we should also disable build indicator
    options.build.indicator = false
  }

  // Components Module
  // TODO: Webpack5 support
  // if (!options._start && getPKG('@nuxt/components')) {
  //   options._modules.push('@nuxt/components')
  // }

  // Nuxt Telemetry
  if (
    options.telemetry !== false &&
    !options.test &&
    !destr(process.env.NUXT_TELEMETRY_DISABLED) &&
    getPKG('@nuxt/telemetry')
  ) {
    options._modules.push('@nuxt/telemetry')
  }

  return options
}
