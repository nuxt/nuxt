
import consola from 'consola'
import { spawn } from 'child_process'
import NuxtCommand from './command'
import listCommands from './list'
import setup from './setup'

export default async function run(custom = null) {
  if (custom) {
    custom.run().catch(error => consola.fatal(error))
  }

  const cmd = process.argv[2] || 'dev'
  const subCommand = process.argv[3]

  try {
    const isExternal = await NuxtCommand.ensure(cmd, subCommand)

    if (isExternal) {
      process.argv.splice(2, 1)
      spawn(process.argv[0], process.argv.slice(1))
      return
    }
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
