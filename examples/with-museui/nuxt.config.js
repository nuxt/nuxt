module.exports = {
  head: {
    meta: [
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      }
    ],
    link: [
      {
        rel: 'stylesheet',
        href:
     'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700,400italic'
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/icon?family=Material+Icons'
      },
      {
        rel: 'stylesheet',
        href: 'https://unpkg.com/muse-ui@2.1.0/dist/muse-ui.css'
      }
    ]
  },
  plugins: ['~/plugins/museui']
}
