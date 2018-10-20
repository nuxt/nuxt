import consola from 'consola'
import NuxtCommand from '../common/command'

export default async function build() {
  const nuxtCmd = new NuxtCommand({
    description: 'Generate a static web application (server-rendered)',
    usage: 'generate <dir>',
    options: [ 'build' ]
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
    process.exitCode = 0
  }).catch(err => consola.fatal(err))
}
