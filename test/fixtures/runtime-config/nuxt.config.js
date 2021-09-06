export default {
  publicRuntimeConfig: {
    baseURL: process.env.BASE_URL,
    isFixture: true,
    TOKEN: 'default',
    nested: {
      priv: 0,
      pub: 1
    }
  },
  privateRuntimeConfig: {
    baseURL: '${PUBLIC_URL}${BASE_URL}',
    API_SECRET: '',
    FOO: '123/${FOO}',
    nested: {
      priv: 1
    }
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
