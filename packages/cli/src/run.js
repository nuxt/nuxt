import consola from 'consola'
import NuxtCommand from './command'
import listCommands from './list'
import setup from './setup'

export default function run() {
  const cmd = process.argv[2] || 'dev'
  try {
    NuxtCommand.ensure(cmd)
  } catch (notFoundError) {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      return listCommands().then(process.exit)
    } else {
      throw notFoundError
    }
  }
  process.argv.splice(2, 1)
  setup({ dev: cmd === 'dev' })

  return NuxtCommand.load(cmd)
    .then(command => command.run())
    .catch(error => consola.fatal(error))
}
