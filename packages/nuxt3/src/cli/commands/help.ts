import consola from 'consola'
import listCommands from '../list'
import { common } from '../options'
import NuxtCommand from '../command'
import getCommand from '.'

export default {
  name: 'help',
  description: 'Shows help for <command>',
  usage: 'help <command>',
  options: {
    help: common.help,
    version: common.version
  },
  async run (cmd: NuxtCommand) {
    const [name] = cmd._argv
    if (!name) {
      return listCommands()
    }
    const command = await getCommand(name)

    if (!command) {
      consola.info(`Unknown command: ${name}`)
      return
    }

    NuxtCommand.from(command).showHelp()
  }
}
