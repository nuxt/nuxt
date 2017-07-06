module.exports = {
  loading: true,
  modules: [
    '~/modules/basic', // Use ~ for deprication warning coverage
    {
      src: '~/modules/middleware',
      options: {
        foo: 'bar'
      }
    },
    ['./modules/template', {baz: 'ping'}]
  ],
  serverMiddleware: [
    './modules/middleware/midd2'
  ]
}
