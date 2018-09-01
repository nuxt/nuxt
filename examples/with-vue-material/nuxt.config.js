export default {
  head: {
    meta: [
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, minimal-ui'
      }
    ],
    link: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700,400italic|Material+Icons'
      },
      {
        rel: 'stylesheet',
        href: 'https://unpkg.com/vue-material@beta/dist/vue-material.min.css'
      },
      {
        rel: 'stylesheet',
        href: 'https://unpkg.com/vue-material@beta/dist/theme/default.css'
      }
    ]
  },
  plugins: ['~/plugins/vue-material']
}
