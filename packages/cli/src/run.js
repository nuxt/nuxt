import consola from 'consola'
import NuxtCommand from './command'
import * as commands from './commands'
import setup from './setup'
import listCommands from './list'

export default function run() {
  const defaultCommand = 'dev'
  let cmd = process.argv[2]

  const _commands = { ...commands }
  if (_commands[cmd]) {
    process.argv.splice(2, 1)
  } else {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      listCommands(_commands).then(() => process.exit(0))
      return
    }
    cmd = defaultCommand
  }

  // Setup runtime
  setup({
    dev: cmd === 'dev'
  })

  return NuxtCommand.load(cmd)
    .then(command => command.run())
    .catch((error) => {
      consola.fatal(error)
    })
}
