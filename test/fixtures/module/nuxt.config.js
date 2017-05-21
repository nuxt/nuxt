module.exports = {
  loading: true,
  modules: [
    '~modules/basic',
    '~/modules/middleware',
    './modules/template'
  ],
  serverMiddleware: [
    './modules/middleware/midd2'
  ]
}
