import env from 'std-env'

export default () => ({
  quiet: Boolean(env.ci || env.test),
  analyze: false,
  profile: process.argv.includes('--profile'),
  extractCSS: false,
  cssSourceMap: undefined,
  ssr: undefined,
  parallel: false,
  cache: false,
  standalone: false,
  publicPath: '/_nuxt/',
  serverURLPolyfill: 'url',
  filenames: {
    // { isDev, isClient, isServer }
    app: ({ isDev, isModern }) => isDev ? `[name]${isModern ? '.modern' : ''}.js` : `[name]${isModern ? '.modern' : ''}.js?[contenthash:7]`,
    chunk: ({ isDev, isModern }) => isDev ? `[name]${isModern ? '.modern' : ''}.js` : `[name]${isModern ? '.modern' : ''}.js?[contenthash:7]`,
    css: ({ isDev }) => isDev ? '[name].css' : 'css/[name].css?[contenthash:7]',
    img: ({ isDev }) => isDev ? '[path][name].[ext]' : 'img/[name].[ext]?[contenthash:7]',
    font: ({ isDev }) => isDev ? '[path][name].[ext]' : 'fonts/[name].[ext]?[contenthash:7]',
    video: ({ isDev }) => isDev ? '[path][name].[ext]' : 'videos/[name].[ext]?[contenthash:7]'
  },
  loaders: {
    file: { esModule: false },
    fontUrl: { esModule: false, limit: 1000 },
    imgUrl: { esModule: false, limit: 1000 },
    pugPlain: {},
    vue: {
      transformAssetUrls: {
        video: 'src',
        source: 'src',
        object: 'src',
        embed: 'src'
      }
    },
    css: {
      esModule: false,
      modules: {
        compileType: 'icss'
      }
    },
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
  optimizeCSS: undefined,
  optimization: {
    runtimeChunk: 'single',
    minimize: undefined,
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
    cacheDirectory: undefined
  },
  transpile: [], // Name of NPM packages to be transpiled
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
    // stats will be printed by webapckbar StateReporter
    stats: 'none'
  },
  hotMiddleware: {},

  stats: {
    excludeAssets: [
      /.map$/,
      /index\..+\.html$/,
      /vue-ssr-(client|modern)-manifest.json/
    ]
  },
  friendlyErrors: true,
  additionalExtensions: [],
  warningIgnoreFilters: [],

  followSymlinks: false,

  loadingScreen: {},
  indicator: {
    position: 'bottom-right',
    backgroundColor: '#2E495E',
    color: '#00C48D'
  }
})
