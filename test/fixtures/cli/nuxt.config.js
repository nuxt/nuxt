export default {
  serverMiddleware: [
    '~/middleware.js',
    (_, _, next) => next()
  ],
  watch: ['~/custom.file'],
  hooks(hook) {
    hook('listen', (server, { port, host }) => {
      process.stdout.write(`Listening on http://${host}:${port}`)
    })
  }
}
