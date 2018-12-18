import consola from 'consola'
import NuxtCommand from '../command'
import listCommands from '../list'
import { common } from '../options'

export default {
  name: 'help',
  description: 'Shows help for <command>',
  usage: 'help <command>',
  options: {
    help: common.help,
    version: common.version
  },
  async run(cmd) {
    const argv = cmd.getArgv()
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
