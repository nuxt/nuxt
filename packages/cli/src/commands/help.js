import consola from 'consola'
import * as commands from '../commands'
// import { common, server } from '../options'

export default {
  name: 'dev',
  description: 'Shows help for <command>',
  usage: 'help <command>',
  async run(cmd) {
    const argv = cmd.getArgv()._
    const name = argv[0] || null
    if (commands[name]) {
      // eslint-disable-next-line
      const command = NuxtCommand.from(
        await commands[name]().then(m => m.default)
      )
      command.showHelp()
    } else {
      if (name === null) {
        consola.fatal(`Please specify a command`)
      } else {
        consola.fatal(`Unknown command: ${name}`)
      }
    }
  }
}
