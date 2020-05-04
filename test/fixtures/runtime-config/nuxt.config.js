export default {
  publicRuntimeConfig: {
    baseURL: process.env.BASE_URL
  },
  privateRuntimeConfig: {
    baseURL: '${PUBLIC_URL}${BASE_URL}',
    API_SECRET: ''
  }
}
