import consola from 'consola'
import chalk from 'chalk'
import boxen from 'boxen'

let _setup = false

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
        process.stderr.write(boxen([
          chalk.red('✖ Nuxt Fatal Error'),
          '',
          chalk.white(String(logObj.args[0]))
        ].join('\n'), {
          borderColor: 'red',
          borderStyle: 'round',
          padding: 1,
          margin: 1
        }) + '\n')
        process.exit(1)
      }
    }
  })

  // Wrap all console logs with consola for better DX
  consola.wrapConsole()
}
