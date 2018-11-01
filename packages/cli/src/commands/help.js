import consola from 'consola'
import * as commands from '../commands'
import NuxtCommand from '../command'

export default {
  name: 'help',
  description: 'Shows help for <command>',
  usage: 'help <command>',
  async run(cmd) {
    const argv = cmd.getArgv()._
    const name = argv[0] || null
    const command = await NuxtCommand.load(name)
    if (command) {
      command.showHelp()
    } else if (name === null) {
      consola.info(`Please specify a command`)
    } else {
      consola.info(`Unknown command: ${name}`)
    }
  }
}
