import process from 'node:process'
import { defu } from 'defu'
import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  webpack: {
    analyze: {
      $resolve: async (val, get) => {
        const value = typeof val === 'boolean' ? { enabled: val } : (val && typeof val === 'object' ? val : {})
        return defu(value, await get('build.analyze') as { enabled?: boolean } | Record<string, unknown>)
      },
    },
    profile: process.argv.includes('--profile'),
    extractCSS: true,
    cssSourceMap: {
      $resolve: async (val, get) => typeof val === 'boolean' ? val : await get('dev'),
    },
    serverURLPolyfill: 'url',
    filenames: {
      app: ({ isDev }: { isDev: boolean }) => isDev ? '[name].js' : '[contenthash:7].js',
      chunk: ({ isDev }: { isDev: boolean }) => isDev ? '[name].js' : '[contenthash:7].js',
      css: ({ isDev }: { isDev: boolean }) => isDev ? '[name].css' : 'css/[contenthash:7].css',
      img: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'img/[name].[contenthash:7].[ext]',
      font: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'fonts/[name].[contenthash:7].[ext]',
      video: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'videos/[name].[contenthash:7].[ext]',
    },
    loaders: {
      $resolve: async (val, get) => {
        const loaders: Record<string, any> = val && typeof val === 'object' ? val : {}
        const styleLoaders = [
          'css', 'cssModules', 'less',
          'sass', 'scss', 'stylus', 'vueStyle',
        ]
        for (const name of styleLoaders) {
          const loader = loaders[name]
          if (loader && loader.sourceMap === undefined) {
            loader.sourceMap = Boolean(
              // @ts-expect-error TODO: remove legacay configuration
              await get('build.cssSourceMap'),
            )
          }
        }
        return loaders
      },
      esbuild: {
        $resolve: async (val, get) => {
          return defu(val && typeof val === 'object' ? val : {}, await get('esbuild.options'))
        },
      },
      file: { esModule: false, limit: 1000 },
      fontUrl: { esModule: false, limit: 1000 },
      imgUrl: { esModule: false, limit: 1000 },
      pugPlain: {},
      vue: {
        transformAssetUrls: {
          $resolve: async (val, get) => (val ?? (await get('vue.transformAssetUrls'))),
        },
        compilerOptions: {
          $resolve: async (val, get) => (val ?? (await get('vue.compilerOptions'))),
        },
        propsDestructure: {
          $resolve: async (val, get) => Boolean(val ?? await get('vue.propsDestructure')),
        },
      },
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
    },
    plugins: [],
    aggressiveCodeRemoval: false,
    optimizeCSS: {
      $resolve: async (val, get) => {
        if (val === false || (val && typeof val === 'object')) {
          return val
        }
        // @ts-expect-error TODO: remove legacy configuration
        const extractCSS = await get('build.extractCSS')
        return extractCSS ? {} : false
      },
    },
    optimization: {
      runtimeChunk: 'single',
      minimize: {
        $resolve: async (val, get) => typeof val === 'boolean' ? val : !(await get('dev')),
      },
      minimizer: undefined,
      splitChunks: {
        chunks: 'all',
        automaticNameDelimiter: '/',
        cacheGroups: {},
      },
    },
    postcss: {
      postcssOptions: {
        plugins: {
          $resolve: async (val, get) => val && typeof val === 'object' ? val : (await get('postcss.plugins')),
        },
      },
    },
    devMiddleware: {
      stats: 'none',
    },
    hotMiddleware: {},
    friendlyErrors: true,
    warningIgnoreFilters: [],
    experiments: {},
  },
})
