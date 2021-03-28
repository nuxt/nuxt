import env from 'std-env'
import { hasProtocol } from 'ufo'

export default {
  quiet: Boolean(env.ci || env.test),
  analyze: false,
  profile: process.argv.includes('--profile'),
  extractCSS: false,
  cssSourceMap: {
    $resolve: (val, get) => val ?? get('dev')
  },
  ssr: undefined,
  parallel: {
    $resolve: (val, get) => get('build.extractCSS') ? false : Boolean(val)
  },
  cache: false,
  standalone: false,
  publicPath: {
    $resolve: (val, get) => {
      if (hasProtocol(val, true) && get('dev')) { val = null }
      return (val || '/_nuxt/').replace(/([^/])$/, '$1/')
    }
  },
  serverURLPolyfill: 'url',
  filenames: {
    app: ({ isDev, isModern }) => isDev ? `[name]${isModern ? '.modern' : ''}.js` : `[contenthash:7]${isModern ? '.modern' : ''}.js`,
    chunk: ({ isDev, isModern }) => isDev ? `[name]${isModern ? '.modern' : ''}.js` : `[contenthash:7]${isModern ? '.modern' : ''}.js`,
    css: ({ isDev }) => isDev ? '[name].css' : 'css/[contenthash:7].css',
    img: ({ isDev }) => isDev ? '[path][name].[ext]' : 'img/[name].[contenthash:7].[ext]',
    font: ({ isDev }) => isDev ? '[path][name].[ext]' : 'fonts/[name].[contenthash:7].[ext]',
    video: ({ isDev }) => isDev ? '[path][name].[ext]' : 'videos/[name].[contenthash:7].[ext]'
  },
  loaders: {
    // $resolve: (val, get) => {
    //   const styleLoaders = [
    //     'css', 'cssModules', 'less',
    //     'sass', 'scss', 'stylus', 'vueStyle'
    //   ]
    //   for (const name of styleLoaders) {
    //     const loader = val[name]
    //     if (loader && loader.sourceMap === undefined) {
    //       loader.sourceMap = Boolean(get('build.cssSourceMap'))
    //     }
    //   }
    // },
    file: { esModule: false },
    fontUrl: { esModule: false, limit: 1000 },
    imgUrl: { esModule: false, limit: 1000 },
    pugPlain: {},
    vue: {
      productionMode: { $resolve: (val, get) => val ?? get('dev') },
      transformAssetUrls: {
        video: 'src',
        source: 'src',
        object: 'src',
        embed: 'src'
      }
    },
    css: { esModule: false },
    cssModules: {
      esModule: false,
      modules: {
        localIdentName: '[local]_[hash:base64:5]'
      }
    },
    less: {},
    sass: {
      sassOptions: {
        indentedSyntax: true
      }
    },
    scss: {},
    stylus: {},
    vueStyle: {}
  },
  styleResources: {},
  plugins: [],
  terser: {},
  hardSource: false,
  aggressiveCodeRemoval: false,
  optimizeCSS: {
    $resolve: (val, get) => val ?? (get('build.extractCSS') ? {} : false)
  },
  optimization: {
    runtimeChunk: 'single',
    minimize: { $resolve: (val, get) => val ?? get('dev') },
    minimizer: undefined,
    splitChunks: {
      chunks: 'all',
      automaticNameDelimiter: '/',
      cacheGroups: {}
    }
  },
  splitChunks: {
    layouts: false,
    pages: true,
    commons: true
  },
  corejs: 'auto',
  babel: {
    configFile: false,
    babelrc: false,
    presets: {},
    cacheDirectory: {
      $resolve: (val, get) => val ?? get('dev')
    }
  },
  transpile: {
    $resolve: val => [].concat(val).filter(Boolean)
  },
  postcss: {
    preset: {
      // https://cssdb.org/#staging-process
      stage: 2
    }
  },
  html: {
    minify: {
      collapseBooleanAttributes: true,
      decodeEntities: true,
      minifyCSS: true,
      minifyJS: true,
      processConditionalComments: true,
      removeEmptyAttributes: true,
      removeRedundantAttributes: true,
      trimCustomFragments: true,
      useShortDoctype: true
    }
  },

  template: undefined,
  templates: [],

  watch: [],
  devMiddleware: {
    stats: 'none'
  },
  hotMiddleware: {},

  vendor: {
    $meta: {
      deprecated: 'vendor has been deprecated since nuxt 2'
    }
  },

  stats: {
    $resolve: (val, get) => (val === 'none' || get('build.quite')) ? false : val,
    excludeAssets: [
      /.map$/,
      /index\..+\.html$/,
      /vue-ssr-(client|modern)-manifest.json/
    ]
  },
  friendlyErrors: true,
  additionalExtensions: [],
  warningIgnoreFilters: [],

  followSymlinks: false
}
