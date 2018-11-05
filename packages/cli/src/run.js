import consola from 'consola'
import NuxtCommand from './command'
import * as commands from './commands'
import setup from './setup'
import listCommands from './list'

export default function run() {
  const defaultCommand = 'dev'
  let cmd = process.argv[2]

  if (commands[cmd]) { // eslint-disable-line import/namespace
    process.argv.splice(2, 1)
  } else {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      listCommands().then(() => process.exit(0))
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
