const prefix = process.env.PREFIX || ''

export default {
  privateRuntimeConfig: {
    secret: prefix + '#123'
  },
  publicRuntimeConfig: {
    baseURL: prefix + '#/foo/bar'
  }
}
