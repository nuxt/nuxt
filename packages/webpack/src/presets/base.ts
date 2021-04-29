import { resolve, normalize } from 'path'
import TimeFixPlugin from 'time-fix-plugin'
import WebpackBar from 'webpackbar'
import consola from 'consola'
import { DefinePlugin, Configuration } from 'webpack'
import FriendlyErrorsWebpackPlugin from '@nuxt/friendly-errors-webpack-plugin'
import { escapeRegExp } from 'lodash'
import { hasProtocol, joinURL } from 'ufo'
import WarningIgnorePlugin from '../plugins/warning-ignore'
import { WebpackConfigContext, applyPresets, fileName } from '../utils/config'

export function base (ctx: WebpackConfigContext) {
  applyPresets(ctx, [
    baseAlias,
    baseConfig,
    basePlugins,
    baseResolve
  ])
}

function baseConfig (ctx: WebpackConfigContext) {
  const { options } = ctx

  ctx.config = {
    name: ctx.name,
    entry: { app: [resolve(options.buildDir, `entry.${ctx.name}`)] },
    module: { rules: [] },
    plugins: [],
    externals: [],
    optimization: {
      ...options.build.optimization as any,
      minimizer: []
    },
    mode: ctx.isDev ? 'development' : 'production',
    cache: getCache(ctx),
    output: getOutput(ctx),
    stats: 'none',
    ...ctx.config
  }
}

function basePlugins (ctx: WebpackConfigContext) {
  const { config, options, nuxt } = ctx

  // Add timefix-plugin before others plugins
  if (options.dev) {
    config.plugins.push(new TimeFixPlugin())
  }

  // User plugins
  config.plugins.push(...(options.build.plugins || []))

  // Ignore empty warnings
  config.plugins.push(new WarningIgnorePlugin(getWarningIgnoreFilter(ctx)))

  // Provide env via DefinePlugin
  config.plugins.push(new DefinePlugin(getEnv(ctx)))

  // Friendly errors
  if (
    ctx.isServer ||
    (ctx.isDev && !options.build.quiet && options.build.friendlyErrors)
  ) {
    ctx.config.plugins.push(
      new FriendlyErrorsWebpackPlugin({
        clearConsole: false,
        reporter: 'consola',
        logLevel: 'ERROR' // TODO
      })
    )
  }

  // Webpackbar
  const colors = {
    client: 'green',
    server: 'orange',
    modern: 'blue'
  }
  config.plugins.push(new WebpackBar({
    name: ctx.name,
    color: colors[ctx.name],
    reporters: ['stats'],
    stats: !ctx.isDev,
    reporter: {
      // @ts-ignore
      change: (_, { shortPath }) => {
        if (!ctx.isServer) {
          nuxt.callHook('bundler:change', shortPath)
        }
      },
      done: ({ state }) => {
        if (state.hasErrors) {
          nuxt.callHook('bundler:error')
        } else {
          consola.success(`${state.name} ${state.message}`)
        }
      },
      allDone: () => {
        nuxt.callHook('bundler:done')
      },
      progress ({ statesArray }) {
        nuxt.callHook('bundler:progress', statesArray)
      }
    }
  }))
}

function baseAlias (ctx: WebpackConfigContext) {
  const { options } = ctx

  ctx.alias = {
    '#app': options.appDir,
    '#build': options.buildDir,
    ...options.alias,
    ...ctx.alias
  }
}

function baseResolve (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  // Prioritize nested node_modules in webpack search path (#2558)
  // TODO: this might be refactored as default modulesDir?
  const webpackModulesDir = ['node_modules'].concat(options.modulesDir)

  config.resolve = {
    extensions: ['.wasm', '.mjs', '.js', '.ts', '.json', '.vue', '.jsx', '.tsx'],
    alias: ctx.alias,
    modules: webpackModulesDir,
    fullySpecified: false,
    ...config.resolve
  }

  config.resolveLoader = {
    modules: webpackModulesDir,
    ...config.resolveLoader
  }
}

export function baseTranspile (ctx: WebpackConfigContext) {
  const { options } = ctx

  const transpile = [
    /\.vue\.js/i, // include SFCs in node_modules
    /consola\/src/
  ]

  for (let pattern of options.build.transpile) {
    if (typeof pattern === 'function') {
      pattern = pattern(ctx)
    }
    if (typeof pattern === 'string') {
      const posixModule = pattern.replace(/\\/g, '/')
      // TODO: should only do for clientside? (hint: pathNormalize)
      transpile.push(new RegExp(escapeRegExp(normalize(posixModule))))
    } else if (pattern instanceof RegExp) {
      transpile.push(pattern)
    }
  }

  // TODO: unique
  ctx.transpile = [...transpile, ...ctx.transpile]
}

function getCache (ctx: WebpackConfigContext): Configuration['cache'] {
  const { options } = ctx

  if (!options.dev) {
    return false
  }

  // TODO: Disable for nuxt internal dev due to inconsistencies
  // return {
  //   name: ctx.name,
  //   type: 'filesystem',
  //   cacheDirectory: resolve(ctx.options.rootDir, 'node_modules/.cache/webpack'),
  //   managedPaths: [
  //     ...ctx.options.modulesDir
  //   ],
  //   buildDependencies: {
  //     config: [
  //       ...ctx.options._nuxtConfigFiles
  //     ]
  //   }
  // }
}

function getOutput (ctx: WebpackConfigContext): Configuration['output'] {
  const { options } = ctx

  return {
    path: resolve(options.buildDir, 'dist', ctx.isServer ? 'server' : 'client'),
    filename: fileName(ctx, 'app'),
    chunkFilename: fileName(ctx, 'chunk'),
    publicPath: hasProtocol(options.build.publicPath, true)
      ? options.build.publicPath
      : joinURL(options.router.base, options.build.publicPath)
  }
}

function getWarningIgnoreFilter (ctx: WebpackConfigContext) {
  const { options } = ctx

  const filters = [
    // Hide warnings about plugins without a default export (#1179)
    warn => warn.name === 'ModuleDependencyWarning' &&
      warn.message.includes('export \'default\'') &&
      warn.message.includes('nuxt_plugin_'),
    ...(options.build.warningIgnoreFilters || [])
  ]

  return warn => !filters.some(ignoreFilter => ignoreFilter(warn))
}

function getEnv (ctx: WebpackConfigContext) {
  const { options } = ctx

  const _env = {
    'process.env.NODE_ENV': JSON.stringify(ctx.config.mode),
    'process.mode': JSON.stringify(ctx.config.mode),
    'process.dev': options.dev,
    'process.static': options.target === 'static',
    'process.target': JSON.stringify(options.target),
    'process.env.VUE_ENV': JSON.stringify(ctx.name),
    'process.browser': ctx.isClient,
    'process.client': ctx.isClient,
    'process.server': ctx.isServer,
    'process.modern': ctx.isModern
  }

  if (options.build.aggressiveCodeRemoval) {
    _env['typeof process'] = JSON.stringify(ctx.isServer ? 'object' : 'undefined')
    _env['typeof window'] = _env['typeof document'] = JSON.stringify(!ctx.isServer ? 'object' : 'undefined')
  }

  Object.entries(options.env).forEach(([key, value]) => {
    const isNative = ['boolean', 'number'].includes(typeof value)
    _env['process.env.' + key] = isNative ? value : JSON.stringify(value)
  })

  return _env
}
