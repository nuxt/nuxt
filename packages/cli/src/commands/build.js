import consola from 'consola'
import NuxtCommand from '../common/command'

export default async function build() {
  const nuxtCmd = new NuxtCommand({
    description: 'Compiles the application for production deployment',
    usage: 'build <dir>',
    options: [ 'analyze', 'quiet' ]
  })

  const argv = nuxtCmd.getArgv()

  // Create production build when calling `nuxt build` (dev: false)
  const nuxt = await nuxtCmd.getNuxt(
    await nuxtCmd.getNuxtConfig(argv, { dev: false })
  )

  // Setup hooks
  nuxt.hook('error', err => consola.fatal(err))

  let builderOrGenerator
  if (nuxt.options.mode !== 'spa' || argv.generate === false) {
    // Build only
    builderOrGenerator = (await nuxtCmd.getBuilder(nuxt)).build()
  } else {
    // Build + Generate for static deployment
    builderOrGenerator = (await nuxtCmd.getGenerator(nuxt)).generate({
      build: true
    })
  }

  return builderOrGenerator
    .then(() => {
      // In analyze mode wait for plugin
      // emitting assets and opening browser
      if (
        nuxt.options.build.analyze === true ||
        typeof nuxt.options.build.analyze === 'object'
      ) {
        return
      }

      process.exit(0)
    })
    .catch(err => consola.fatal(err))
}
