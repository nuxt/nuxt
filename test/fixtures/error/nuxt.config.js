export default {
  hooks(hook) {
    hook('build:done', nuxt => {
      throw new Error('hook error')
    })
    hook('error', ({message}, from) => {
      console.log(`[${from}]: ${message}`) // eslint-disable-line no-console
    })
  },
  build: {
    stats: false
  }
}
