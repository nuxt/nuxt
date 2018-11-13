import fs from 'fs'
import path from 'path'
import consola from 'consola'
import { common, server } from '../options'
import { showBanner } from '../utils'

export default {
  name: 'run',
  description: 'Run locally defined commands in the root Nuxt project directory',
  usage: 'run <custom-cmd>',
  async run(cmd) {
    const argv = cmd.getArgv()

  }
}
