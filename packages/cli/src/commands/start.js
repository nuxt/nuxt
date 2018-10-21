import fs from 'fs'
import path from 'path'
import consola from 'consola'
import NuxtCommand from '../common/command'

export default async function start() {
  const nuxtCmd = new NuxtCommand({
    description: 'Start the application in production mode (the application should be compiled with `nuxt build` first)',
    usage: 'start <dir> -p <port number> -H <hostname>',
    options: [ 'hostname', 'port', 'unix-socket' ]
  })

  const argv = nuxtCmd.getArgv()

  // Create production build when calling `nuxt build`
  const nuxt = await nuxtCmd.getNuxt(
    await nuxtCmd.getNuxtConfig(argv, { dev: false })
  )

  // Setup hooks
  nuxt.hook('error', err => consola.fatal(err))

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
        'No SSR build! Please start with `nuxt start --spa` or build using `nuxt build --universal`'
      )
    }
  }

  return nuxt.listen().then(() => {
    nuxt.showReady(false)
  })
}
