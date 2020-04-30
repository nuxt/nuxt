const prefix = process.env.PREFIX || ''

export default {
  runtimeConfig: {
    server: {
      secret: prefix + '123',
      baseURL: prefix + '/foo/bar/server'
    },
    public: {
      baseURL: prefix + '/foo/bar'
    }
  }
}
