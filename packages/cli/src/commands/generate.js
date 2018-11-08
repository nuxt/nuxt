import consola from 'consola'
import { common } from '../options'

export default {
  name: 'generate',
  description: 'Generate a static web application (server-rendered)',
  usage: 'generate <dir>',
  options: {
    ...common,
    build: {
      type: 'boolean',
      default: true,
      description: 'Only generate pages for dynamic routes. Nuxt has to be built once before using this option'
    },
    modern: {
      ...common.modern,
      description: 'Generate app in modern build (modern mode can be only client)',
      prepare(cmd, options, argv) {
        if (argv.modern) {
          options.modern = 'client'
        }
      }
    }
  },
  async run(cmd) {
    const argv = cmd.getArgv()

    const generator = await cmd.getGenerator(
      await cmd.getNuxt(
        await cmd.getNuxtConfig(argv, { dev: false })
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
