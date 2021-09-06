import consola from 'consola'
import exit from 'exit'
import { checkDependencies } from './utils/dependencies'
import { fatalBox } from './utils/formatting'

let _setup = false

export default function setup ({ dev }) {
  // Apply default NODE_ENV if not provided
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = dev ? 'development' : 'production'
  }

  if (_setup) {
    return
  }
  _setup = true

  checkDependencies()

  // Global error handler
  /* istanbul ignore next */
  process.on('unhandledRejection', (err) => {
    consola.error(err)
  })

  // Exit process on fatal errors
  /* istanbul ignore next */
  consola.addReporter({
    log (logObj) {
      if (logObj.type === 'fatal') {
        const errorMessage = String(logObj.args[0])
        process.stderr.write(fatalBox(errorMessage))
        exit(1)
      }
    }
  })

  // Wrap all console logs with consola for better DX
  consola.wrapConsole()
}
