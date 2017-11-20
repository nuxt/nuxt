module.exports = {
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/proxy'
  ],
  proxy: [
    ['/api/dog', { target: 'https://dog.ceo/', pathRewrite: { '^/api/dog': '/api/breeds/image/random' } }]
  ]
}
