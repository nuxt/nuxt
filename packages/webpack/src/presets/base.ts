import { resolve, normalize } from 'pathe'
// @ts-expect-error missing types
import TimeFixPlugin from 'time-fix-plugin'
import WebpackBar from 'webpackbar'
import webpack from 'webpack'
import { logger } from '@nuxt/kit'
// @ts-expect-error missing types
import FriendlyErrorsWebpackPlugin from '@nuxt/friendly-errors-webpack-plugin'
import escapeRegExp from 'escape-string-regexp'
import { joinURL } from 'ufo'
import type { WarningFilter } from '../plugins/warning-ignore'
import WarningIgnorePlugin from '../plugins/warning-ignore'
import type { WebpackConfigContext } from '../utils/config'
import { applyPresets, fileName } from '../utils/config'

export function base (ctx: WebpackConfigContext) {
  applyPresets(ctx, [
    baseAlias,
    baseConfig,
    basePlugins,
    baseResolve,
    baseTranspile
  ])
}

function baseConfig (ctx: WebpackConfigContext) {
  const { options } = ctx

  ctx.config = {
    name: ctx.name,
    entry: { app: [resolve(options.appDir, options.experimental.asyncEntry ? 'entry.async' : 'entry')] },
    module: { rules: [] },
    plugins: [],
    externals: [],
    optimization: {
      ...options.webpack.optimization,
      minimizer: []
    },
    experiments: {},
    mode: ctx.isDev ? 'development' : 'production',
    cache: getCache(ctx),
    output: getOutput(ctx),
    stats: 'none',
    ...ctx.config
  }
}

function basePlugins (ctx: WebpackConfigContext) {
  const { config, options, nuxt } = ctx

  config.plugins = config.plugins || []

  // Add timefix-plugin before other plugins
  if (options.dev) {
    config.plugins.push(new TimeFixPlugin())
  }

  // User plugins
  config.plugins.push(...(options.webpack.plugins || []))

  // Ignore empty warnings
  config.plugins.push(new WarningIgnorePlugin(getWarningIgnoreFilter(ctx)))

  // Provide env via DefinePlugin
  config.plugins.push(new webpack.DefinePlugin(getEnv(ctx)))

  // Friendly errors
  if (ctx.isServer || (ctx.isDev && options.webpack.friendlyErrors)) {
    config.plugins.push(
      new FriendlyErrorsWebpackPlugin({
        clearConsole: false,
        reporter: 'consola',
        logLevel: 'ERROR' // TODO
      })
    )
  }

  if (nuxt.options.webpack.profile) {
    // Webpackbar
    const colors = {
      client: 'green',
      server: 'orange',
      modern: 'blue'
    }
    config.plugins.push(new WebpackBar({
      name: ctx.name,
      color: colors[ctx.name as keyof typeof colors],
      reporters: ['stats'],
      stats: !ctx.isDev,
      reporter: {
        // @ts-ignore
        change: (_, { shortPath }) => {
          if (!ctx.isServer) {
            nuxt.callHook('webpack:change', shortPath)
          }
        },
        // @ts-ignore
        done: ({ state }) => {
          if (state.hasErrors) {
            nuxt.callHook('webpack:error')
          } else {
            logger.success(`${state.name} ${state.message}`)
          }
        },
        allDone: () => {
          nuxt.callHook('webpack:done')
        },
        // @ts-ignore
        progress ({ statesArray }) {
          nuxt.callHook('webpack:progress', statesArray)
        }
      }
    }))
  }
}

function baseAlias (ctx: WebpackConfigContext) {
  const { options } = ctx

  ctx.alias = {
    '#app': options.appDir,
    '#build/plugins': resolve(options.buildDir, 'plugins', ctx.isClient ? 'client' : 'server'),
    '#build': options.buildDir,
    ...options.alias,
    ...ctx.alias
  }
  if (ctx.isClient) {
    ctx.alias['#internal/nitro'] = resolve(ctx.nuxt.options.buildDir, 'nitro.client.mjs')
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
    /consola\/src/,
    /vue-demi/
  ]

  for (let pattern of options.build.transpile) {
    if (typeof pattern === 'function') {
      const result = pattern(ctx)
      if (result) { pattern = result }
    }
    if (typeof pattern === 'string') {
      transpile.push(new RegExp(escapeRegExp(normalize(pattern))))
    } else if (pattern instanceof RegExp) {
      transpile.push(pattern)
    }
  }

  // TODO: unique
  ctx.transpile = [...transpile, ...ctx.transpile]
}

function getCache (ctx: WebpackConfigContext): webpack.Configuration['cache'] {
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

function getOutput (ctx: WebpackConfigContext): webpack.Configuration['output'] {
  const { options } = ctx

  return {
    path: resolve(options.buildDir, 'dist', ctx.isServer ? 'server' : joinURL('client', options.app.buildAssetsDir)),
    filename: fileName(ctx, 'app'),
    chunkFilename: fileName(ctx, 'chunk'),
    publicPath: joinURL(options.app.baseURL, options.app.buildAssetsDir)
  }
}

function getWarningIgnoreFilter (ctx: WebpackConfigContext): WarningFilter {
  const { options } = ctx

  const filters: WarningFilter[] = [
    // Hide warnings about plugins without a default export (#1179)
    warn => warn.name === 'ModuleDependencyWarning' &&
      warn.message.includes('export \'default\'') &&
      warn.message.includes('nuxt_plugin_'),
    ...(options.webpack.warningIgnoreFilters || [])
  ]

  return warn => !filters.some(ignoreFilter => ignoreFilter(warn))
}

function getEnv (ctx: WebpackConfigContext) {
  const { options } = ctx

  const _env: Record<string, string | boolean> = {
    'process.env.NODE_ENV': JSON.stringify(ctx.config.mode),
    'process.mode': JSON.stringify(ctx.config.mode),
    'process.dev': options.dev,
    __NUXT_VERSION__: JSON.stringify(ctx.nuxt._version),
    'process.env.VUE_ENV': JSON.stringify(ctx.name),
    'process.browser': ctx.isClient,
    'process.client': ctx.isClient,
    'process.server': ctx.isServer
  }

  if (options.webpack.aggressiveCodeRemoval) {
    _env['typeof process'] = JSON.stringify(ctx.isServer ? 'object' : 'undefined')
    _env['typeof window'] = _env['typeof document'] = JSON.stringify(!ctx.isServer ? 'object' : 'undefined')
  }

  return _env
}
