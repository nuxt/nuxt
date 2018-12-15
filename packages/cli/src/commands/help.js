import consola from 'consola'
import NuxtCommand from '../command'
import listCommands from '../list'

export default {
  name: 'help',
  description: 'Shows help for <command>',
  usage: 'help <command>',
  async run(cmd) {
    const argv = cmd.getArgv()._
    const name = argv[0] || null
    if (!name) {
      return listCommands().then(() => process.exit(0))
    }
    const command = await NuxtCommand.load(name)
    if (command) {
      command.showHelp()
    } else {
      consola.info(`Unknown command: ${name}`)
    }
  }
}
