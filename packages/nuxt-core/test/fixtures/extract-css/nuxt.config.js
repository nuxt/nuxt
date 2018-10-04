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
    }
  },
  css: [
    '~/assets/global.css'
  ]
}
