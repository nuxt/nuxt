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
    }
  },
  async run() {
    const argv = this.getArgv()
    const config = await this.getNuxtConfig(argv, { dev: false })
    const nuxt = await this.getNuxt(config)

    if (argv.build && argv.lock) {
      const lockRelease = await this.lock(config.buildDir, { autoUnlock: false })
      if (lockRelease) {
        nuxt.hook('build:done', () => lockRelease())
      }
    }

    const generator = await this.getGenerator(nuxt)

    return generator.generate({
      init: true,
      build: argv.build
    })
  }
}
