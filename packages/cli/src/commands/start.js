import { common, server } from '../options'
import { showBanner } from '../utils'

export default {
  name: 'start',
  description: 'Start the application in production mode (the application should be compiled with `nuxt build` first)',
  usage: 'start <dir>',
  options: {
    ...common,
    ...server
  },
  async run(cmd) {
    const argv = cmd.getArgv()

    // Create production build when calling `nuxt build`
    const nuxt = await cmd.getNuxt(
      await cmd.getNuxtConfig(argv, { dev: false, _start: true })
    )

    // Listen and show ready banner
    return nuxt.server.listen().then(() => {
      showBanner(nuxt)
    })
  }
}
