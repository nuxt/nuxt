import consola from 'consola'
import chalk from 'chalk'
import env from 'std-env'
import { common, server } from '../options'
import { showBanner } from '../utils'

export default {
  name: 'dev',
  description: 'Start the application in development mode (e.g. hot-code reloading, error reporting)',
  usage: 'dev <dir>',
  options: {
    ...common,
    ...server
  },

  async run(cmd) {
    const argv = cmd.getArgv()
    await this.startDev(cmd, argv)
  },

  async startDev(cmd, argv) {
    try {
      await this._startDev(cmd, argv)
    } catch (error) {
      consola.error(error)
    }
  },

  async _startDev(cmd, argv) {
    // Load config
    const config = await cmd.getNuxtConfig(argv, { dev: true })

    // Initialize nuxt instance
    const nuxt = await cmd.getNuxt(config)

    // Setup hooks
    nuxt.hook('watch:restart', payload => this.onWatchRestart(payload, { nuxt, builder, cmd, argv }))
    nuxt.hook('bundler:change', changedFileName => this.onBundlerChange(changedFileName))

    // Start listening
    await nuxt.server.listen()

    // Create builder instance
    const builder = await cmd.getBuilder(nuxt)

    // Start Build
    await builder.build()

    // Show banner after build
    showBanner(nuxt)

    // Return instance
    return nuxt
  },

  logChanged({ event, path, nuxt }) {
    const eventsMapping = {
      add: { icon: '+', color: 'green', suffix: 'added' },
      change: { icon: env.windows ? '»' : '↻', color: 'blue', suffix: 'updated' },
      unlink: { icon: '-', color: 'yellow', suffix: 'removed' }
    }
    const filename = path
      .replace(nuxt.options.srcDir, '~')
      .replace(nuxt.options.rootDir, '~~')
    const logParams = eventsMapping[event] || eventsMapping.change

    consola.log({
      type: 'change',
      icon: chalk[logParams.color].bold(logParams.icon),
      message: chalk[logParams.color](filename + ' ' + logParams.suffix)
    })
  },

  async onWatchRestart({ event, path }, { nuxt, cmd, argv }) {
    this.logChanged({ event, path, nuxt })

    await nuxt.close()

    await this.startDev(cmd, argv)
  },

  onBundlerChange(changedFileName) {
    this.logChanged(changedFileName)
  }
}
