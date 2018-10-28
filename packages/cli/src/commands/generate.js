import consola from 'consola'
import NuxtCommand from '../command'

export default async function generate() {
  const nuxtCmd = new NuxtCommand({
    description: 'Generate a static web application (server-rendered)',
    usage: 'generate <dir>',
    options: {
      build: {
        type: 'boolean',
        default: true,
        description: 'Only generate pages for dynamic routes. Nuxt has to be built once before using this option'
      }
    }
  })

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
