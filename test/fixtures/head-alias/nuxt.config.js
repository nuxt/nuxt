export default {
  head: {
    link: [
      {
        rel: 'icon',
        type: 'image/png',
        href: '~/assets/favicon.png'
      }
    ]
  },
  build: {
    filenames: {
      img: '[name].[ext]'
    }
  }
}
