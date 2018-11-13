import fs from 'fs'
import path from 'path'
import consola from 'consola'
import NuxtCommand from '../command'
import { showBanner } from '../utils'

export default {
  name: 'run',
  description: 'Run locally defined commands in the root Nuxt project directory',
  usage: 'run <customCmd>',
  async run(cmd) {
    const argv = cmd.getArgv()
    const customCmd = argv._[0]
    try { 
      NuxtCommand.ensure(cmd, '.')
    } catch (notFoundError) {
      if (process.argv.includes('--help') || process.argv.includes('-h')) {
        return listCommands('.').then(process.exit)
      } else {
        throw notFoundError
      }
    }
    return NuxtCommand.load(cmd, '.')
      .then(command => command.run())
  }
}
