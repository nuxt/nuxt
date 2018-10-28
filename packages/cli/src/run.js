import consola from 'consola'
import * as commands from './commands'
import loader from './loader'
import setup from './setup'

export default function run() {
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
  } else if (typeof cmd === 'string' && cmd.length) {
    loader(cmd)
  } else {
    cmd = defaultCommand
  }

  // Setup runtime
  setup({
    dev: cmd === 'dev'
  })

  return commands[cmd]() // eslint-disable-line import/namespace
    .then(m => m.default.run())
    .catch((error) => {
      consola.fatal(error)
    })
}
