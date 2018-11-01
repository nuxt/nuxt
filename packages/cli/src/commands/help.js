import consola from 'consola'
import commands from '../commands'
import { common, server } from '../options'

export default {
  name: 'dev',
  description: 'Shows help for <command>',
  usage: 'help <command>',
  async run(cmd) {
    const argv = cmd.getArgv()
    console.log('argv', argv)
  }
}
