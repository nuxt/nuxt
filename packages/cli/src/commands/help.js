import consola from 'consola'
import * as commands from '../commands'
// import { common, server } from '../options'

export default {
  name: 'dev',
  description: 'Shows help for <command>',
  usage: 'help <command>',
  async run(cmd) {
    const argv = cmd.getArgv()._
    if (argv.length) {
      const name = argv[0]
      // eslint-disable-next-line
      const command = await commands[name]().then(m => m.default)
      consola.info(command.usage)
    }
  }
}
