export default {
  build: {
    extractCSS: true,
    optimization: {
      splitChunks: {
        name: true
      }
    }
  },
  css: [
    '~/assets/global.css'
  ]
}
