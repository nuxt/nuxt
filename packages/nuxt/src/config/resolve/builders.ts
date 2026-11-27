import process from 'node:process'
import { existsSync } from 'node:fs'
import { relative, resolve } from 'pathe'
import { defu } from 'defu'
import type { NuxtOptions } from '@nuxt/schema'

import { DEFAULT_JS_FILE_EXTENSIONS } from '../constants.ts'
import { optionsDiagnostics } from '../diagnostics.ts'
import { isObject, objectOrEmpty, withDefaults } from '../validate.ts'
import type { RawConfig } from '../validate.ts'

export type BuilderOptions = Pick<NuxtOptions, 'vite' | 'webpack' | 'esbuild' | 'oxc' | 'rsbuild'>

type Resolved = Pick<NuxtOptions, 'rootDir' | 'srcDir' | 'buildDir' | 'workspaceDir' | 'dev' | 'test' | 'debug' | 'builder' | 'vue' | 'app' | 'build' | 'postcss' | 'experimental'>

export function resolveBuilders (input: RawConfig, resolved: Resolved): BuilderOptions {
  const esbuild = resolveEsbuild(input.esbuild, resolved)
  return {
    vite: resolveVite(input.vite, resolved),
    webpack: resolveWebpack(input.webpack, resolved, esbuild.options),
    esbuild,
    oxc: withDefaults('oxc', input.oxc, {
      transform: {
        options: {
          target: 'esnext',
          jsxFactory: 'h',
          jsxFragment: 'Fragment',
        },
      },
    }) as NuxtOptions['oxc'],
    rsbuild: isObject(input.rsbuild) ? input.rsbuild : {},
  }
}

function resolveEsbuild (value: unknown, resolved: Resolved): NuxtOptions['esbuild'] {
  const esbuild = objectOrEmpty(value)
  const options = withDefaults('esbuild.options', esbuild.options, { jsxFactory: 'h', jsxFragment: 'Fragment' })
  const decorators = resolved.experimental.decorators === true

  // Only lower to es2024 for non-vite builders (webpack/rspack) where esbuild handles decorator
  // lowering. The vite builder uses Babel instead.
  // https://github.com/vitejs/vite-plugin-vue/issues/528
  const target = typeof options.target === 'string'
    ? options.target
    : resolved.builder !== '@nuxt/vite-builder' && decorators ? 'es2024' : 'esnext'

  const tsconfigRaw = typeof options.tsconfigRaw === 'string' ? JSON.parse(options.tsconfigRaw) : objectOrEmpty(options.tsconfigRaw)

  return {
    ...esbuild,
    options: {
      ...options,
      target,
      // `experimentalDecorators` would select the legacy decorators transform
      tsconfigRaw: decorators ? defu({ compilerOptions: { experimentalDecorators: false } }, tsconfigRaw) : tsconfigRaw,
    },
  } as NuxtOptions['esbuild']
}

function resolveVite (value: unknown, resolved: Resolved): NuxtOptions['vite'] {
  const { rootDir, srcDir, buildDir, workspaceDir, dev, test, debug, vue } = resolved
  const vite = objectOrEmpty(value)
  if (vite.publicDir) {
    optionsDiagnostics.NUXT_B5014()
  }

  const viteVue = objectOrEmpty(vite.vue)
  const template = objectOrEmpty(viteVue.template)
  const script = objectOrEmpty(viteVue.script)
  const features = objectOrEmpty(viteVue.features)
  const vueJsx = objectOrEmpty(vite.vueJsx)
  const optimizeDeps = objectOrEmpty(vite.optimizeDeps)
  const build = objectOrEmpty(vite.build)
  const server = objectOrEmpty(vite.server)
  const fs = objectOrEmpty(server.fs)

  return {
    ...vite,
    root: typeof vite.root === 'string' ? vite.root : srcDir,
    mode: typeof vite.mode === 'string' ? vite.mode : (dev ? 'development' : 'production'),
    define: {
      '__VUE_OPTIONS_API__': vue.optionsApi,
      '__VUE_PROD_DEVTOOLS__': false,
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': Boolean(debug && debug.hydration),
      'process.dev': dev,
      'import.meta.dev': dev,
      'process.test': test,
      'import.meta.test': test,
      ...objectOrEmpty(vite.define),
    },
    resolve: withDefaults('vite.resolve', vite.resolve, {
      extensions: [...DEFAULT_JS_FILE_EXTENSIONS, '.vue', '.json'],
    }),
    // missing from the `vite` types so that it is not configured directly
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    publicDir: false as never,
    vue: {
      ...viteVue,
      isProduction: typeof viteVue.isProduction === 'boolean' ? viteVue.isProduction : !dev,
      template: {
        ...template,
        compilerOptions: template.compilerOptions ?? vue.compilerOptions,
        transformAssetUrls: template.transformAssetUrls ?? vue.transformAssetUrls,
      },
      script: {
        ...script,
        hoistStatic: typeof script.hoistStatic === 'boolean' ? script.hoistStatic : vue.compilerOptions?.hoistStatic,
      },
      features: {
        ...features,
        propsDestructure: typeof features.propsDestructure === 'boolean'
          ? features.propsDestructure
          : Boolean((vue as { script?: { propsDestructure?: boolean } }).script?.propsDestructure ?? vue.propsDestructure),
      },
    },
    vueJsx: {
      // TODO: investigate type divergence between types for @vue/compiler-core and @vue/babel-plugin-jsx
      isCustomElement: vue.compilerOptions?.isCustomElement as undefined | ((tag: string) => boolean),
      ...vueJsx,
      defineComponentName: [...new Set([...vueJsx.defineComponentName ?? ['defineComponent'], 'defineNuxtComponent'])],
    },
    optimizeDeps: {
      ...optimizeDeps,
      exclude: [...Array.isArray(optimizeDeps.exclude) ? optimizeDeps.exclude : [], 'vue-demi'],
    },
    clearScreen: vite.clearScreen === undefined ? true : vite.clearScreen,
    build: {
      ...build,
      assetsDir: typeof build.assetsDir === 'string' ? build.assetsDir : resolved.app.buildAssetsDir.replace(/^\/+/, ''),
      emptyOutDir: build.emptyOutDir === undefined ? false : build.emptyOutDir,
    },
    server: {
      ...server,
      fs: {
        ...fs,
        allow: [...new Set([buildDir, srcDir, rootDir, workspaceDir, ...Array.isArray(fs.allow) ? fs.allow : []])],
      },
    },
    cacheDir: typeof vite.cacheDir === 'string' ? vite.cacheDir : resolveViteCacheDir(rootDir, workspaceDir),
  } as NuxtOptions['vite']
}

function resolveViteCacheDir (rootDir: string, workspaceDir: string): string {
  if (existsSync(resolve(rootDir, 'node_modules'))) {
    return resolve(rootDir, 'node_modules/.cache/vite')
  }
  const relativeRoot = relative(workspaceDir, rootDir)
  if (!relativeRoot || relativeRoot.startsWith('..')) {
    return resolve(rootDir, 'node_modules/.cache/vite')
  }
  return resolve(workspaceDir, 'node_modules/.cache/vite', relativeRoot)
}

const STYLE_LOADERS = ['css', 'cssModules', 'less', 'sass', 'scss', 'stylus', 'vueStyle'] as const

function resolveWebpack (value: unknown, resolved: Resolved, esbuildOptions: NuxtOptions['esbuild']['options']): NuxtOptions['webpack'] {
  const { dev, vue } = resolved
  const webpack = withDefaults('webpack', value, {
    profile: process.argv.includes('--profile'),
    extractCSS: true,
    serverURLPolyfill: 'url',
    filenames: {
      app: ({ isDev }: { isDev: boolean }) => isDev ? '[name].js' : '[contenthash:7].js',
      chunk: ({ isDev }: { isDev: boolean }) => isDev ? '[name].js' : '[contenthash:7].js',
      css: ({ isDev }: { isDev: boolean }) => isDev ? '[name].css' : 'css/[contenthash:7].css',
      img: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'img/[name].[contenthash:7].[ext]',
      font: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'fonts/[name].[contenthash:7].[ext]',
      video: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'videos/[name].[contenthash:7].[ext]',
    },
    plugins: [],
    aggressiveCodeRemoval: false,
    devMiddleware: { stats: 'none' },
    hotMiddleware: {},
    friendlyErrors: true,
    warningIgnoreFilters: [],
    experiments: {},
  })

  const loaders = withDefaults('webpack.loaders', webpack.loaders, {
    file: { esModule: false, limit: 1000 },
    fontUrl: { esModule: false, limit: 1000 },
    imgUrl: { esModule: false, limit: 1000 },
    pugPlain: {},
    css: {
      importLoaders: 0,
      url: {
        filter: (url: string, _resourcePath: string) => url[0] !== '/',
      },
      esModule: false,
    },
    cssModules: {
      importLoaders: 0,
      url: {
        filter: (url: string, _resourcePath: string) => url[0] !== '/',
      },
      esModule: false,
      modules: {
        localIdentName: '[local]_[hash:base64:5]',
      },
    },
    less: {},
    sass: {
      sassOptions: {
        indentedSyntax: true,
      },
    },
    scss: {},
    stylus: {},
    vueStyle: {},
  })
  for (const name of STYLE_LOADERS) {
    const loader = loaders[name]
    if (loader && loader.sourceMap === undefined) {
      loaders[name] = { ...loader, sourceMap: false }
    }
  }
  const vueLoader = objectOrEmpty(loaders.vue)
  loaders.esbuild = defu(objectOrEmpty(loaders.esbuild), esbuildOptions)
  loaders.vue = {
    ...vueLoader,
    transformAssetUrls: vueLoader.transformAssetUrls ?? vue.transformAssetUrls,
    compilerOptions: vueLoader.compilerOptions ?? vue.compilerOptions,
    propsDestructure: Boolean(vueLoader.propsDestructure ?? vue.propsDestructure),
  }

  const optimization = withDefaults('webpack.optimization', webpack.optimization, {
    runtimeChunk: 'single',
  })
  const postcss = objectOrEmpty(webpack.postcss)
  const postcssOptions = objectOrEmpty(postcss.postcssOptions)

  return {
    ...webpack,
    analyze: defu(typeof webpack.analyze === 'boolean' ? { enabled: webpack.analyze } : objectOrEmpty(webpack.analyze), resolved.build.analyze),
    cssSourceMap: typeof webpack.cssSourceMap === 'boolean' ? webpack.cssSourceMap : dev,
    loaders,
    optimizeCSS: webpack.optimizeCSS === false || isObject(webpack.optimizeCSS) ? webpack.optimizeCSS : false,
    optimization: {
      ...optimization,
      minimize: typeof optimization.minimize === 'boolean' ? optimization.minimize : !dev,
      splitChunks: optimization.splitChunks === false
        ? false
        : withDefaults('webpack.optimization.splitChunks', optimization.splitChunks, {
            chunks: 'all',
            automaticNameDelimiter: '/',
            cacheGroups: {},
          }),
    },
    postcss: {
      ...postcss,
      postcssOptions: {
        ...postcssOptions,
        plugins: isObject(postcssOptions.plugins) ? postcssOptions.plugins : resolved.postcss.plugins,
      },
    },
  } as NuxtOptions['webpack']
}
