pkg = require('./package')
module.exports =
  mode: 'universal'
  #
  # Headers of the page
  #
  head:
    title: pkg.name
    meta:
      [
        {
          charset: 'utf-8'
        }
        {
          name: 'viewport'
          content: 'width=device-width, initial-scale=1'
        }
        {
          hid: 'description'
          name: 'description'
          content: pkg.description
        }
      ]
    link:
      [
        rel: 'icon'
        type: 'image/x-icon'
        href: '/favicon.ico'
      ]
  # Customize the progress-bar color
  loading:
    {
      color: '#3B8070'
    }
  # Global CSS
  css: []
  # Plugins to load before mounting the App
  plugins: []
  # Nuxt.js modules
  modules:
    [
      '~/modules/coffeescript'
    ]
  # Build configuration
  build:
    # You can extend webpack config here
    extend = (config, ctx) ->
      pass
