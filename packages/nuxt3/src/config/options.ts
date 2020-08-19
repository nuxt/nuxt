import path from 'path'
import fs from 'fs'
import consola from 'consola'
import defu from 'defu'
import defaultsDeep from 'lodash/defaultsDeep'
import pick from 'lodash/pick'
import uniq from 'lodash/uniq'
import destr from 'destr'
import { TARGETS, MODES, guardDir, isNonEmptyString, isPureObject, isUrl, getMainModule, urlJoin, getPKG } from 'src/utils'
import type { EnvConfig } from 'src/config/load'
import { DefaultConfiguration, defaultNuxtConfigFile, getDefaultNuxtConfig } from './config'
import { deleteProp, mergeConfigs, setProp, overrideProp, Optional } from './transformers'

interface InputConfiguration {
  appTemplatePath?: string
  layoutTransition?: string | DefaultConfiguration['layoutTransition']
  loading?: true | false | DefaultConfiguration['loading']
  manifest?: {
    // eslint-disable-next-line camelcase
    theme_color?: string
  }
  pageTransition?: string | DefaultConfiguration['pageTransition']
  rootDir?: string
  store?: boolean
}

export interface Configuration extends InputConfiguration, Optional<Omit<DefaultConfiguration, keyof InputConfiguration>> { }

export interface CliConfiguration extends Configuration {
  // cli
  _build?: boolean
  _cli?: boolean
  _export?: boolean
  _generate?: boolean
  _start?: boolean
  _ready?: boolean
  _legacyGenerate?: boolean
  _env?: NodeJS.ProcessEnv
  _envConfig?: EnvConfig
  _nuxtConfigFiles?: string[]
}

export function getNuxtConfig (_options: Configuration) {
  // Prevent duplicate calls
  if ('__normalized__' in _options) {
    return _options
  }

  return normalizeConfig(_options as CliConfiguration)
}

function normalizeConfig (_options: CliConfiguration) {
  // Clone options to prevent unwanted side-effects
  const _config: CliConfiguration = Object.assign({}, _options)

  setProp(_config, '__normalized__', true as const)

  // Normalize options
  if (_config.loading === true) {
    deleteProp(_config, 'loading')
  }

  setProp(_config, '_routerBaseSpecified', _config.router && typeof _config.router.base === 'string')

  overrideProp(_config, 'pageTransition', typeof _config.pageTransition === 'string' ? { name: _config.pageTransition } : _config.pageTransition)
  overrideProp(_config, 'layoutTransition', typeof _config.layoutTransition === 'string' ? { name: _config.layoutTransition } : _config.layoutTransition)

  if (typeof _config.extensions === 'string') {
    _config.extensions = [_config.extensions]
  }

  overrideProp(_config, 'globalName',
    (isNonEmptyString(_config.globalName) && /^[a-zA-Z]+$/.test(_config.globalName))
      ? _config.globalName.toLowerCase()
      // use `` for preventing replacing to nuxt-edge
      : 'nuxt'
  )

  // Resolve rootDir
  overrideProp(_config, 'rootDir',
    isNonEmptyString(_config.rootDir) ? path.resolve(_config.rootDir) : process.cwd()
  )

  // Apply defaults by ${buildDir}/dist/build.config.js
  // TODO: Unsafe operation.
  // const buildDir = _config.buildDir || defaults.buildDir
  // const buildConfig = resolve(_config.rootDir, buildDir, 'build.config.js')
  // if (existsSync(buildConfig)) {
  //   defaultsDeep(_config, require(buildConfig))
  // }

  // Fall back to default if publicPath is falsy
  if (_config.build && !_config.build.publicPath) {
    _config.build.publicPath = undefined
  }

  // Apply defaults
  const options = mergeConfigs(_config, getDefaultNuxtConfig())

  // Target
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
  overrideProp(options, 'srcDir', hasSrcDir
    ? path.resolve(options.rootDir, options.srcDir)
    : options.rootDir)

  // Resolve buildDir
  overrideProp(options, 'buildDir', path.resolve(options.rootDir, options.buildDir))

  // Aliases
  const { rootDir, srcDir, dir: { assets: assetsDir, static: staticDir } } = options
  overrideProp(options, 'alias', {
    '~~': rootDir,
    '@@': rootDir,
    '~': srcDir,
    '@': srcDir,
    [assetsDir]: path.join(srcDir, assetsDir),
    [staticDir]: path.join(srcDir, staticDir),
    ...options.alias
  })

  // Default value for _nuxtConfigFile
  overrideProp(options, '_nuxtConfigFile', options._nuxtConfigFile || path.resolve(options.rootDir, `${defaultNuxtConfigFile}.js`))

  setProp(options, '_nuxtConfigFiles', (options as any)._nuxtConfigFiles || [
    options._nuxtConfigFile
  ])

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

  const mandatoryExtensions = ['js', 'mjs', 'ts', 'tsx', 'vue', 'jsx']

  overrideProp(options, 'extensions', mandatoryExtensions
    .filter(ext => !options.extensions.includes(ext))
    .concat(options.extensions))

  // If app.html is defined, set the template path to the user template
  if (options.appTemplatePath === undefined) {
    options.appTemplatePath = path.resolve(options.buildDir, 'views/app.template.html')
    if (fs.existsSync(path.join(options.srcDir, 'app.html'))) {
      options.appTemplatePath = path.join(options.srcDir, 'app.html')
    }
  } else {
    options.appTemplatePath = path.resolve(options.srcDir, options.appTemplatePath)
  }

  overrideProp(options.build, 'publicPath', options.build.publicPath.replace(/([^/])$/, '$1/'))
  overrideProp(options.build, '_publicPath', options.build._publicPath.replace(/([^/])$/, '$1/'))

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
        color: (options.loading && typeof options.loading !== 'string' && typeof options.loading !== 'boolean' && options.loading.color) || '#D3D3D3',
        color2: '#F5F5F5',
        background: (options.manifest && options.manifest.theme_color) || 'white',
        dev: options.dev,
        loading: options.messages.loading
      },
      options.loadingIndicator
    )
  }

  // Debug errors
  overrideProp(options, 'debug', options.debug ?? options.dev)

  // Validate that etag.hash is a function, if not unset it
  if (options.render.etag) {
    const { hash } = options.render.etag
    if (hash) {
      const isFn = hash instanceof Function
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
  }

  // cssSourceMap
  overrideProp(options.build, 'cssSourceMap', options.build.cssSourceMap ?? options.dev)

  // babel cacheDirectory
  const babelConfig = options.build.babel
  overrideProp(options.build.babel, 'cacheDirectory', babelConfig.cacheDirectory ?? options.dev)

  // Vue config
  const vueConfig = options.vue.config

  overrideProp(options.vue.config, 'performance', vueConfig.performance !== undefined ? vueConfig.performance : options.dev)

  // merge custom env with variables
  const eligibleEnvVariables = pick(process.env, Object.keys(process.env).filter(k => k.startsWith('NUXT_ENV_')))
  overrideProp(options, 'env', Object.assign(options.env, eligibleEnvVariables))

  // Normalize ignore
  overrideProp(options, 'ignore', options.ignore ? Array.from(options.ignore) : [])

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

  overrideProp(options.render, 'ssrLog', options.dev
    ? options.render.ssrLog === undefined || options.render.ssrLog
    : false)

  // We assume the SPA fallback path is 404.html (for GitHub Pages, Surge, etc.)
  overrideProp(options.generate, 'fallback', options.generate.fallback === true ? '404.html' : options.generate.fallback)

  if (options.build.stats === 'none' || options.build.quiet === true) {
    options.build.stats = false
  }

  // @pi0 - surely this can go
  // // Vendor backward compatibility with nuxt 1.x
  // if (typeof options.build.vendor !== 'undefined') {
  //   delete options.build.vendor
  //   consola.warn('vendor has been deprecated due to webpack4 optimization')
  // }

  // Disable CSS extraction due to incompatibility with thread-loader
  if (options.build.extractCSS && options.build.parallel) {
    options.build.parallel = false
    consola.warn('extractCSS cannot work with parallel build due to limited work pool in thread-loader')
  }

  // build.extractCSS.allChunks has no effect
  if (typeof options.build.extractCSS !== 'boolean' && typeof options.build.extractCSS.allChunks !== 'undefined') {
    consola.warn('build.extractCSS.allChunks has no effect from v2.0.0. Please use build.optimization.splitChunks settings instead.')
  }

  // Enable minimize for production builds
  if (options.build.optimization.minimize === undefined) {
    options.build.optimization.minimize = !options.dev
  }

  // Enable cssMinimizer only when extractCSS is enabled
  if (options.build.optimization.cssMinimizer === undefined) {
    options.build.optimization.cssMinimizer = options.build.extractCSS ? {} : false
  }

  const { loaders } = options.build
  // const vueLoader = loaders.vue
  // if (vueLoader.productionMode === undefined) {
  //   vueLoader.productionMode = !options.dev
  // }
  const styleLoaders: Array<keyof typeof loaders> = [
    'css', 'cssModules', 'less',
    'sass', 'scss', 'stylus', 'vueStyle'
  ]
  for (const name of styleLoaders) {
    const loader = loaders[name]
    if (loader && loader.sourceMap === undefined) {
      loader.sourceMap = Boolean(options.build.cssSourceMap)
    }
  }

  overrideProp(options.build, 'transpile', Array.from(options.build.transpile || []))
  options.build.transpile = [].concat(options.build.transpile || [])
  options.build.transpile.push('app')

  if (options.build.quiet === true) {
    consola.level = 0
  }

  // Use runInNewContext for dev mode by default
  const { bundleRenderer } = options.render
  overrideProp(options.render.bundleRenderer, 'runInNewContext', bundleRenderer.runInNewContext ?? options.dev)

  // const { timing } = options.server
  if (options.server && typeof options.server !== 'boolean' && options.server.timing) {
    overrideProp(options.server, 'timing', { total: true, ...options.server.timing })
  }

  overrideProp(options, 'serverMiddleware', Array.isArray(options.serverMiddleware) ? options.serverMiddleware : Object.entries(options.serverMiddleware)
    .map(([path, handler]) => ({ path, handler }))
  )

  // Generate staticAssets
  const { staticAssets } = options.generate
  overrideProp(options.generate.staticAssets, 'version', options.generate.staticAssets.version || String(Math.round(Date.now() / 1000)))

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

export type NormalizedConfiguration = ReturnType<typeof normalizeConfig>
