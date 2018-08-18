export default {
  hooks(hook) {
    hook('build:done', () => {
      process.stdout.write('Compiled successfully')
    })
    hook('listen', (server, { port, host }) => {
      process.stdout.write(`Listening on http://${host}:${port}`)
    })
  }
}
