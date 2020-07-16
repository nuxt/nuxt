import { TARGETS } from '@nuxt/utils'
import { common, server } from '../options'
import { showBanner } from '../utils/banner'
import { serve } from '../utils/serve'

export default {
  name: 'start',
  description: 'Start the application in production mode (the application should be compiled with `nuxt build` first)',
  usage: 'start <dir>',
  options: {
    ...common,
    ...server
  },
  async run (cmd) {
    const config = await cmd.getNuxtConfig({ dev: false, _start: true })

    if (config.target === TARGETS.static) {
      return serve(cmd)
    }

    const nuxt = await cmd.getNuxt(config)

    // Listen and show ready banner
    await nuxt.server.listen()
    showBanner(nuxt)
  }
}
