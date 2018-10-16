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
  css: [{ src: '~/custom-assets/app.css' }],
  dir: {
    assets: 'custom-assets',
    layouts: 'custom-layouts/layouts',
    middleware: 'custom-middleware',
    pages: 'custom-pages',
    static: 'custom-static',
    store: 'custom-store'
  }
}
