export default {
  build: {
    extractCSS: true,
    optimization: {
      splitChunks: {
        name: true
      }
    },
    postcss: {
      postcssOptions: {
        plugins: {
          autoprefixer: {
            grid: true
          }
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
