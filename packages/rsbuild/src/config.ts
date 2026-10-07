import { resolve as resolvePlatformPath } from 'node:path'

import type { Nuxt } from '@nuxt/schema'
import type { EnvironmentConfig, RsbuildConfig, RsbuildPlugins } from '@rsbuild/core'
import { mergeRsbuildConfig } from '@rsbuild/core'
import { pluginVue } from '@rsbuild/plugin-vue'
import { defu } from 'defu'
import escapeRegExp from 'escape-string-regexp'
import { basename, normalize, resolve } from 'pathe'
import { joinURL, withoutLeadingSlash } from 'ufo'
import { defineEnv } from 'unenv'

import { getHMRPath } from './dev-server.ts'
import { DynamicBasePlugin } from './plugins/dynamic-base.ts'
import { NuxtHooksPlugin } from './plugins/hooks.ts'
import { resolveAnalyzePlugin, resolvePreprocessorPlugins, resolveTypeCheckPlugin } from './plugins/optional.ts'
import { ServerPlugin, createServerExternals } from './plugins/server.ts'
import { SSRStylesPlugin } from './plugins/ssr-styles.ts'
import { VueSSRPlugin } from './plugins/vue.ts'
import { resolvePostcssPlugins } from './utils/postcss.ts'

/**
 * Translate Nuxt options into an Rsbuild configuration, with a `client` and
 * (when SSR is enabled) a `server` environment.
 */
export async function resolveRsbuildConfig (nuxt: Nuxt): Promise<RsbuildConfig> {
  const { vue: vuePluginOptions, ...userConfig } = nuxt.options.rsbuild

  const entry = resolve(nuxt.options.appDir, nuxt.options.experimental.asyncEntry ? 'entry.async' : 'entry')
  const assetPrefix = joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir)
  const [postcssPlugins, preprocessorPlugins, typeCheckPlugin, analyzePlugin] = await Promise.all([
    resolvePostcssPlugins(nuxt),
    resolvePreprocessorPlugins(nuxt),
    resolveTypeCheckPlugin(nuxt),
    resolveAnalyzePlugin(nuxt),
  ])

  const plugins: RsbuildPlugins = [
    pluginVue({
      ...vuePluginOptions,
      vueLoaderOptions: defu(vuePluginOptions?.vueLoaderOptions, {
        compilerOptions: nuxt.options.vue.compilerOptions,
        transformAssetUrls: nuxt.options.vue.transformAssetUrls,
        propsDestructure: nuxt.options.vue.propsDestructure,
        // request SFC blocks with `?vue&type=` queries in both environments (as with vue-loader), which
        // the transforms of Nuxt rely on to process them in the same way in the client and server builds
        experimentalInlineMatchResource: false,
      }),
    }),
    VueSSRPlugin(nuxt),
    DynamicBasePlugin(),
    ServerPlugin(nuxt),
    SSRStylesPlugin(nuxt),
    NuxtHooksPlugin(nuxt),
    ...preprocessorPlugins,
  ]

  const config: RsbuildConfig = {
    // Rsbuild passes the root to Rspack as `context`, and neither normalizes it. Use the platform's format, like the
    // `process.cwd()` context of the rspack builder: with forward slashes, unplugin's virtual modules load empty on Windows.
    root: resolvePlatformPath(nuxt.options.rootDir),
    mode: nuxt.options.dev ? 'development' : 'production',
    logLevel: nuxt.options.logLevel === 'silent' ? 'silent' : 'info',
    plugins,
    source: {
      decorators: nuxt.options.experimental.decorators ? { version: '2023-11' } : undefined,
    },
    resolve: {
      alias: {
        '#app': nuxt.options.appDir,
        [basename(nuxt.options.dir.assets)]: resolve(nuxt.options.srcDir, nuxt.options.dir.assets),
        ...nuxt.options.alias,
      },
      // Nuxt aliases are the source of truth, so `tsconfig.json` paths are not used for resolution
      aliasStrategy: 'prefer-alias',
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    },
    output: {
      // Nuxt manages the build directory itself
      cleanDistPath: false,
    },
    tools: {
      // the HTML document is rendered by Nitro
      htmlPlugin: false,
      cssLoader: {
        // root-relative URLs point at files served from the public directory
        url: { filter: (url: string) => url[0] !== '/' },
        // resolve `url()` requests with the aliases of the project (such as `~/assets`), as css-loader
        // only uses the resolver when emitting CommonJS
        esModule: false,
      },
      postcss: (loaderOptions) => {
        // PostCSS is configured with the `postcss` option in `nuxt.config` rather than with a config file
        loaderOptions.postcssOptions = { plugins: [...postcssPlugins] }
      },
      swc: {
        jsc: {
          transform: {
            // match the JSX factory used by the other builders (`h` is auto-imported)
            react: {
              runtime: 'classic',
              pragma: 'h',
              pragmaFrag: 'Fragment',
            },
          },
        },
      },
      rspack: (config) => {
        // Rsbuild has no equivalent option: prefer Nuxt's module directories when resolving packages and loaders
        const modules = ['node_modules', ...nuxt.options.modulesDir]
        config.resolve ||= {}
        config.resolve.modules = modules
        config.resolveLoader ||= {}
        config.resolveLoader.modules = modules
      },
    },
    dev: {
      hmr: nuxt.options.dev,
      liveReload: nuxt.options.dev,
      // assets of async chunks need to be known by the SSR manifest when the page is rendered
      lazyCompilation: false,
      cliShortcuts: false,
      progressBar: false,
      browserLogs: false,
      assetPrefix,
      // the WebSocket is attached to the Nuxt dev server (see `dev-server.ts`)
      client: {
        path: getHMRPath(nuxt),
      },
    },
    server: {
      // requests are forwarded by Nuxt's dev server (see `dev-server.ts`)
      middlewareMode: true,
      cors: false,
      compress: false,
      publicDir: false,
      htmlFallback: false,
      printUrls: false,
    },
    environments: {
      client: {
        ...clientEnvironment(nuxt, { entry, assetPrefix }),
        // type checking runs once, in the server build when SSR is enabled
        plugins: [analyzePlugin, !nuxt.options.ssr && typeCheckPlugin],
      },
      ...nuxt.options.ssr
        ? {
            server: {
              ...serverEnvironment(nuxt, { entry, assetPrefix }),
              plugins: [typeCheckPlugin],
            },
          }
        : {},
    },
  }

  return mergeRsbuildConfig(config, userConfig)
}

interface EnvironmentOptions {
  entry: string
  assetPrefix: string
}

function clientEnvironment (nuxt: Nuxt, { entry, assetPrefix }: EnvironmentOptions): EnvironmentConfig {
  const sourcemap = nuxt.options.sourcemap.client
  const nitroClientRuntime = resolve(nuxt.options.buildDir, 'nitro.client.mjs')
  const nodeCompat = nuxt.options.experimental.clientNodeCompat

  return {
    source: {
      entry: {
        app: { import: [entry], html: false },
      },
      define: {
        ...getDefines(nuxt, 'client'),
        ...nodeCompat ? { global: 'globalThis' } : {},
      },
      include: getTranspilePatterns(nuxt, { isClient: true }),
    },
    resolve: {
      alias: {
        'nitro/runtime-config': nitroClientRuntime,
        // TODO: remove in v5
        '#internal/nitro': nitroClientRuntime,
        'nitropack/runtime': nitroClientRuntime,
      },
    },
    output: {
      target: 'web',
      assetPrefix,
      distPath: {
        root: resolve(nuxt.options.buildDir, 'dist/client', withoutLeadingSlash(nuxt.options.app.buildAssetsDir)),
        ...flatDistPath,
      },
      sourceMap: {
        js: sourcemap ? getDevtool(sourcemap, nuxt.options.dev ? 'cheap-module-source-map' : 'source-map') : false,
        css: !!sourcemap && nuxt.options.dev,
      },
    },
    tools: {
      rspack: nodeCompat
        ? (config, { rspack }) => {
            // Rsbuild has no equivalent options: polyfill Node.js built-ins with unenv only when they cannot be resolved
            config.resolve ||= {}
            config.resolve.fallback = {
              ...defineEnv({ nodeCompat: true, resolve: true }).env.alias,
              ...config.resolve.fallback,
            }
            // https://github.com/webpack/webpack/issues/13290#issuecomment-1188760779
            config.plugins ||= []
            config.plugins.unshift(new rspack.NormalModuleReplacementPlugin(/node:/, (resource) => {
              resource.request = resource.request.replace(/^node:/, '')
            }))
          }
        : undefined,
    },
  }
}

function serverEnvironment (nuxt: Nuxt, { entry, assetPrefix }: EnvironmentOptions): EnvironmentConfig {
  const sourcemap = nuxt.options.sourcemap.server

  return {
    source: {
      entry: {
        app: { import: [entry], html: false },
      },
      define: getDefines(nuxt, 'server'),
      include: getTranspilePatterns(nuxt, { isServer: true }),
    },
    output: {
      target: 'node',
      module: true,
      // asset URLs are shared with the client build, which emits the assets
      emitAssets: false,
      assetPrefix,
      externals: [createServerExternals(nuxt)],
      minify: false,
      distPath: {
        root: resolve(nuxt.options.buildDir, 'dist/server'),
        ...flatDistPath,
      },
      filename: {
        js: pathData => pathData.chunk?.name === 'app' ? 'server.mjs' : '[name].mjs',
      },
      sourceMap: {
        js: sourcemap ? getDevtool(sourcemap, nuxt.options.dev ? 'cheap-module-source-map' : 'source-map') : false,
      },
    },
    splitChunks: false,
  }
}

/** Emit all assets next to each other in the build assets directory, as the Vite builder does. */
const flatDistPath = {
  js: '',
  jsAsync: '',
  css: '',
  cssAsync: '',
  svg: '',
  font: '',
  image: '',
  media: '',
  assets: '',
  wasm: '',
}

function getDevtool (sourcemap: boolean | 'hidden', devtool: 'cheap-module-source-map' | 'source-map') {
  return sourcemap === 'hidden' ? `hidden-${devtool}` as const : devtool
}

function getDefines (nuxt: Nuxt, name: 'client' | 'server') {
  const isClient = name === 'client'
  const isServer = name === 'server'

  const define: Record<string, string | boolean> = {
    '__NUXT_VERSION__': JSON.stringify(nuxt._version),
    '__NUXT_ASYNC_CONTEXT__': nuxt.options.experimental.asyncContext,
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': Boolean(nuxt.options.debug && nuxt.options.debug.hydration),
    'process.env.VUE_ENV': JSON.stringify(name),
    'process.dev': nuxt.options.dev,
    'process.test': nuxt.options.test,
    'process.browser': isClient,
    'process.client': isClient,
    'process.server': isServer,
    'import.meta.dev': nuxt.options.dev,
    'import.meta.test': nuxt.options.test,
    'import.meta.browser': isClient,
    'import.meta.client': isClient,
    'import.meta.envName': JSON.stringify(nuxt.options.envName),
    'import.meta.server': isServer,
  }

  if (isClient) {
    define['process.prerender'] = false
    define['process.nitro'] = false
    define['import.meta.prerender'] = false
    define['import.meta.nitro'] = false
  } else {
    // wrap in an IIFE, forcing it to be evaluated at runtime
    define['process.prerender'] = '(()=>process.prerender)()'
    define['process.nitro'] = '(()=>process.nitro)()'
    define['import.meta.prerender'] = '(()=>import.meta.prerender)()'
    define['import.meta.nitro'] = '(()=>import.meta.nitro)()'
  }

  return define
}

/**
 * Files outside of the project (such as `node_modules`) are not transpiled by
 * Rsbuild unless they match `source.include`.
 */
function getTranspilePatterns (nuxt: Nuxt, ctx: { isClient?: boolean, isServer?: boolean }) {
  const patterns: RegExp[] = [
    /consola\/src/,
    /vue-demi/,
    /(^|\/)nuxt\/(src\/|dist\/)?(app|[^/]+\/runtime)($|\/)/,
  ]

  for (let pattern of nuxt.options.build.transpile) {
    if (typeof pattern === 'function') {
      const result = pattern({ ...ctx, isDev: nuxt.options.dev })
      if (!result) { continue }
      pattern = result
    }
    if (typeof pattern === 'string') {
      patterns.push(new RegExp(escapeRegExp(normalize(pattern))))
    } else if (pattern instanceof RegExp) {
      patterns.push(pattern)
    }
  }

  return patterns
}
