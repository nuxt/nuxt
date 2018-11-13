import consola from 'consola'
import NuxtCommand from './command'
import * as commands from './commands'
import listCommands from './list'

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
  return NuxtCommand.load(cmd)
    .then(command => command.run())
    .catch(error => consola.fatal(error))
}
