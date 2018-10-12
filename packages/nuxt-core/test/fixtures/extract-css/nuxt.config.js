export default {
  build: {
    extractCSS: true,
    optimization: {
      splitChunks: {
        name: true
      }
    },
    postcss: {
      preset: {
        autoprefixer: {
          grid: true
        }
      }
    },
    filenames: {
      css: () => {
        return '[name].css'
      }
    }
  },
  css: [
    '~/assets/global.css'
  ]
}
