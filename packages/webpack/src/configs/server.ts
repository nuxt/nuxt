import { isAbsolute, normalize, resolve } from 'pathe'
import { directoryToURL, logger, resolveAlias, tryImportModule } from '@nuxt/kit'
import { parseNodeModulePath } from 'mlly'
import { resolveModulePath } from 'exsolve'
import { runtimeDependencies as runtimeNuxtDependencies } from 'nuxt/meta'
import type { WebpackConfigContext } from '../utils/config.ts'
import { applyPresets } from '../utils/config.ts'
import { nuxt } from '../presets/nuxt.ts'
import { node } from '../presets/node.ts'
import { TsCheckerPlugin, webpack } from '#builder'

const assetPattern = /\.(?:css|s[ca]ss|png|jpe?g|gif|svg|woff2?|eot|ttf|otf|webp|webm|mp4|ogv)(?:\?.*)?$/i
const VIRTUAL_RE = /^\0?virtual:(?:nuxt:)?/

export async function server (ctx: WebpackConfigContext) {
  ctx.name = 'server'
  ctx.isServer = true

  await applyPresets(ctx, [
    nuxt,
    node,
    serverStandalone,
    serverPreset,
    serverPlugins,
  ])
}

function serverPreset (ctx: WebpackConfigContext) {
  ctx.config.output!.filename = 'server.mjs'

  if (ctx.nuxt.options.sourcemap.server) {
    const prefix = ctx.nuxt.options.sourcemap.server === 'hidden' ? 'hidden-' : ''
    ctx.config.devtool = prefix + (ctx.isDev ? 'cheap-module-source-map' : 'source-map')
  } else {
    ctx.config.devtool = false
  }

  ctx.config.optimization = {
    splitChunks: false,
    minimize: false,
  }

  if (ctx.isDev) {
    ctx.config.output!.asyncChunks = false
  }
}

async function serverStandalone (ctx: WebpackConfigContext) {
  // TODO: Refactor this out of webpack
  const inline = [
    'src/',
    '#app',
    'nuxt',
    'nuxt3',
    'nuxt-nightly',
    '!',
    '-!',
    '~',
    '@/',
    '#',
    ...ctx.options.build.transpile,
  ]

  const { runtimeDependencies: runtimeNitroDependencies = [] } = await tryImportModule<typeof import('nitropack/runtime/meta')>('nitropack/runtime/meta', {
    url: new URL(import.meta.url),
  }) || {}

  const external = new Set([
    '#internal/nitro',
    '#shared',
    resolve(ctx.nuxt.options.rootDir, ctx.nuxt.options.dir.shared),
    // explicit dependencies we use in our ssr renderer
    'unhead', '@unhead/vue', '@nuxt/devalue', 'rou3', 'unstorage',
    ...runtimeNuxtDependencies,
    ...runtimeNitroDependencies,
  ])
  if (!ctx.nuxt.options.dev) {
    external.add('#internal/nuxt/paths')
    external.add('#app-manifest')
  }

  if (!Array.isArray(ctx.config.externals)) { return }

  // Resolve conditions for server build
  const conditions = [
    ctx.nuxt.options.dev ? 'development' : 'production',
    'node',
    'import',
    'require',
  ]

  ctx.config.externals.push(({ request, context }, cb) => {
    if (!request) {
      return cb(undefined, false)
    }
    if (external.has(request)) {
      // Resolve to absolute path so nitro can handle version resolution
      const resolved = resolveModulePath(request, {
        from: context ? [context, ...ctx.nuxt.options.modulesDir].map(d => directoryToURL(d)) : ctx.nuxt.options.modulesDir.map(d => directoryToURL(d)),
        suffixes: ['', 'index'],
        conditions,
        try: true,
      })
      if (resolved && isAbsolute(resolved)) {
        return cb(undefined, resolved)
      }
      return cb(undefined, true)
    }
    if (
      request[0] === '.' ||
      isAbsolute(request) ||
      inline.find(prefix => typeof prefix === 'string' && request.startsWith(prefix)) ||
      assetPattern.test(request)
    ) {
      // console.log('Inline', request)
      return cb(undefined, false)
    }

    if (context && request && !request.startsWith('node:') && (isAbsolute(context) || VIRTUAL_RE.test(context))) {
      try {
        const normalisedRequest = resolveAlias(normalize(request), ctx.nuxt.options.alias)
        const dir = parseNodeModulePath(context).dir || ctx.nuxt.options.rootDir

        const resolved = resolveModulePath(normalisedRequest, {
          from: [dir, ...ctx.nuxt.options.modulesDir].map(d => directoryToURL(d)),
          suffixes: ['', 'index'],
          conditions,
          try: true,
        })

        if (resolved && isAbsolute(resolved)) {
          return cb(undefined, false)
        }
      } catch {
        // Ignore resolution errors, fall through to externalize
      }
    }

    // console.log('Ext', request)
    return cb(undefined, true)
  })
}

function serverPlugins (ctx: WebpackConfigContext) {
  ctx.config.plugins ||= []

  // Server polyfills
  if (ctx.userConfig.serverURLPolyfill) {
    ctx.config.plugins.push(new webpack.ProvidePlugin({
      URL: [ctx.userConfig.serverURLPolyfill, 'URL'],
      URLSearchParams: [ctx.userConfig.serverURLPolyfill, 'URLSearchParams'],
    }))
  }

  // Add type-checking
  if (!ctx.nuxt.options.test && (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev))) {
    ctx.config.plugins!.push(new TsCheckerPlugin({
      logger,
    }))
  }
}
