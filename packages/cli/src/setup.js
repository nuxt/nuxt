import Consola from 'consola'

let _setup = false

const consola = Consola.withTag('nuxt:cli:setup')

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

  // Exit process on fatal errors
  /* istanbul ignore next */
  consola.addReporter({
    log(logObj) {
      if (logObj.type === 'fatal') {
        process.stderr.write('Nuxt Fatal Error :(\n')
        process.exit(1)
      }
    }
  })
}
