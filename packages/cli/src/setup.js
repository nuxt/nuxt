import consola from 'consola'

let _setup = false

const gracefulExit = (msg) => {
  consola.info(msg)
  process.exit(1)
}

export default function setup({ dev }) {
  // Apply default NODE_ENV if not provided
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = dev ? 'development' : 'production'
  }

  if (_setup) {
    return
  }
  _setup = true

  // Global error handler
  /* istanbul ignore next */
  process.on('unhandledRejection', (err) => {
    consola.error(err)
  })

  // Graceful exit
  // advised in e.g. https://github.com/moxystudio/node-proper-lockfile#graceful-exit
  process
    .once('SIGINT', () => gracefulExit('Received SIGINT, exiting'))
    .once('SIGTERM', () => gracefulExit('Received SIGTERM, exiting'))

  // Exit process on fatal errors
  /* istanbul ignore next */
  consola.add({
    log(logObj) {
      if (logObj.type === 'fatal') {
        process.stderr.write('Nuxt Fatal Error :(\n')
        process.exit(1)
      }
    }
  })
}
