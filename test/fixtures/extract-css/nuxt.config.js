export default {
  build: {
    extractCSS: true,
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
