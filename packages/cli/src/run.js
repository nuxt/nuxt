import consola from 'consola'
import NuxtCommand from './command'
import * as commands from './commands'
import setup from './setup'

export default function run() {
  const defaultCommand = 'dev'

  const cmds = new Set([
    defaultCommand,
    'ui',
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

  // Setup runtime
  setup({
    dev: ['dev', 'ui'].includes(cmd)
  })

  return commands[cmd]() // eslint-disable-line import/namespace
    .then(m => m.default)
    .then(options => NuxtCommand.from(options))
    .then(command => command.run())
    .catch((error) => {
      consola.fatal(error)
    })
}
