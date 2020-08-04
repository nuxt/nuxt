import { TARGETS } from 'src/utils'

import type NuxtCommand from '../command'
import { common, server } from '../options'
import { showBanner } from '../utils/banner'

export default {
  name: 'start',
  description: 'Start the application in production mode (the application should be compiled with `nuxt build` first)',
  usage: 'start <dir>',
  options: {
    ...common,
    ...server
  },
  async run (cmd: NuxtCommand) {
    const config = await cmd.getNuxtConfig({ dev: false, _start: true })
    if (config.target === TARGETS.static) {
      throw new Error('You cannot use `nuxt start` with ' + TARGETS.static + ' target, please use `nuxt export` and `nuxt serve`')
    }
    const nuxt = await cmd.getNuxt(config)

    // Listen and show ready banner
    await nuxt.server.listen()
    showBanner(nuxt)
  }
}
