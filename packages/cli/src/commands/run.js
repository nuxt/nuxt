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
    if (!NuxtCommand.exists(customCmd, '.')) {
      
    }
  }
}
