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
    const _commands = { ...commands }
    if (name in _commands) {
      const command = NuxtCommand.from(
        await _commands[name]().then(m => m.default)
      )
      command.showHelp()
    } else if (name === null) {
      consola.info(`Please specify a command`)
    } else {
      consola.info(`Unknown command: ${name}`)
    }
  }
}
