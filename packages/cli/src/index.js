import consola from 'consola'
import * as commands from './commands'

export function run() {
  // Global error handler
  /* istanbul ignore next */
  process.on('unhandledRejection', (err) => {
    consola.error(err)
  })

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

  const defaultCommand = 'dev'
  const cmds = new Set([
    defaultCommand,
    'build',
    'start',
    'generate'
  ])

  let cmd = process.argv[2]

  if (cmds.has(cmd)) {
    process.argv.splice(2, 1)
  } else {
    cmd = defaultCommand
  }

  // Apply default NODE_ENV if not provided
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = cmd === 'dev' ? 'development' : 'production'
  }

  return commands[cmd]() // eslint-disable-line import/namespace
    .then(m => m.default())
    .catch((error) => {
      consola.fatal(error)
    })
}
