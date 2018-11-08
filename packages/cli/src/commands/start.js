import fs from 'fs'
import path from 'path'
import consola from 'consola'
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
      await cmd.getNuxtConfig(argv, { dev: false })
    )

    // Check if project is built for production
    const distDir = path.resolve(
      nuxt.options.rootDir,
      nuxt.options.buildDir || '.nuxt',
      'dist',
      'server'
    )
    if (!fs.existsSync(distDir)) {
      consola.fatal(
        'No build files found, please run `nuxt build` before launching `nuxt start`'
      )
    }

    // Check if SSR Bundle is required
    if (nuxt.options.render.ssr === true) {
      const ssrBundlePath = path.resolve(distDir, 'server-bundle.json')
      if (!fs.existsSync(ssrBundlePath)) {
        consola.fatal(
          'No SSR build found.\nPlease start with `nuxt start --spa` or build using `nuxt build --universal`'
        )
      }
    }

    return nuxt.server.listen().then(() => {
      showBanner(nuxt)
    })
  }
}
