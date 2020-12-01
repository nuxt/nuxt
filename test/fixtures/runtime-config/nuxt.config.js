export default {
  publicRuntimeConfig: {
    baseURL: process.env.BASE_URL,
    isFixture: true,
    TOKEN: 'default'
  },
  privateRuntimeConfig: {
    baseURL: '${PUBLIC_URL}${BASE_URL}',
    API_SECRET: '',
    FOO: '123/${FOO}'
  },
  serverMiddleware: [
    (req, _, next) => {
      if (req.url.includes('?spa')) {
        req.spa = true
      }
      next()
    }
  ]
}
