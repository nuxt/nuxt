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
    nuxt.hook('watch:restart', changedFileName => this.onWatchRestart(changedFileName, { nuxt, builder, cmd, argv }))
    nuxt.hook('bundler:change', changedFileName => this.onBundlerChange(changedFileName))

    // Start listening
    await nuxt.server.listen()

    // Create builder instance
    const builder = await cmd.getBuilder(nuxt)

    // Start Build
    await builder.build()

    // setTimeout(() => this.onWatchRestart('Timer', { nuxt, builder, cmd, argv }), 1000)

    // Show banner after build
    showBanner(nuxt)

    // Return instance
    return nuxt
  },

  logChanged(changedFileName) {
    consola.log({
      type: 'change',
      icon: chalk.blue.bold(env.windows ? '»' : '↻'),
      message: chalk.blue(changedFileName)
    })
  },

  async onWatchRestart(changedFileName, { nuxt, builder, cmd, argv }) {
    this.logChanged(changedFileName)

    await nuxt.close()

    await this.startDev(cmd, argv)
  },

  onBundlerChange(changedFileName) {
    this.logChanged(changedFileName)
  }
}
