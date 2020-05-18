export default {
  publicRuntimeConfig: {
    baseURL: process.env.BASE_URL
  },
  privateRuntimeConfig: {
    baseURL: '${PUBLIC_URL}${BASE_URL}',
    API_SECRET: ''
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
