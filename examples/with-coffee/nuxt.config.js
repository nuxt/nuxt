module.exports = {
  /*
  ** Headers of the page
  */
  head: {
    title: 'with-coffee',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: 'Nuxt.js project' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },
  /*
  ** Customize the progress bar color
  */
  loading: { color: '#3B8070' },
  /*
  ** Build configuration
  */
  build: {
    extend (config, ctx) {
      config.module.rules.push({
        test: /\.coffee$/,
        loader: 'coffee-loader'
      })
    }
  }
}
