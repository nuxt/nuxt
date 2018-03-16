export default {
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/proxy'
  ],
  proxy: [
    ['/dog', { target: 'https://dog.ceo/', pathRewrite: { '^/dog': '/api/breeds/image/random' } }]
  ]
}
