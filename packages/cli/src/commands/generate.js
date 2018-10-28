import consola from 'consola'
import commonOptions from '../options/common'
import NuxtCommand from '../command'

export default {
  description: 'Generate a static web application (server-rendered)',
  usage: 'generate <dir>',
  options: {
    ...commonOptions,
    build: {
      type: 'boolean',
      default: true,
      description: 'Only generate pages for dynamic routes. Nuxt has to be built once before using this option'
    }
  },
  async run(nuxtCmd, consola) {
    const argv = nuxtCmd.getArgv()

    const generator = await nuxtCmd.getGenerator(
      await nuxtCmd.getNuxt(
        await nuxtCmd.getNuxtConfig(argv, { dev: false })
      )
    )

    return generator.generate({
      init: true,
      build: argv.build
    }).then(() => {
      process.exit(0)
    }).catch(err => consola.fatal(err))
  }
}
