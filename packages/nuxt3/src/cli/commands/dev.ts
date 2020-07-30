import consola from 'consola'
import chalk from 'chalk'
import opener from 'opener'
import type { ParsedArgs } from 'minimist'

import { Nuxt } from 'nuxt/core'

import type NuxtCommand from '../command'
import { common, server } from '../options'
import { eventsMapping, formatPath } from '../utils'
import { showBanner } from '../utils/banner'
import { showMemoryUsage } from '../utils/memory'

export default {
  name: 'dev',
  description: 'Start the application in development mode (e.g. hot-code reloading, error reporting)',
  usage: 'dev <dir>',
  options: {
    ...common,
    ...server,
    open: {
      alias: 'o',
      type: 'boolean',
      description: 'Opens the server listeners url in the default browser'
    }
  },

  async run (cmd: NuxtCommand) {
    const { argv } = cmd

    await this.startDev(cmd, argv, argv.open)
  },

  async startDev (cmd: NuxtCommand, argv) {
    let nuxt
    try {
      nuxt = await this._listenDev(cmd, argv)
    } catch (error) {
      consola.fatal(error)
      return
    }

    try {
      await this._buildDev(cmd, argv, nuxt)
    } catch (error) {
      await nuxt.callHook('cli:buildError', error)
      consola.error(error)
    }

    return nuxt
  },

  async _listenDev (cmd: NuxtCommand, argv) {
    const config = await cmd.getNuxtConfig({ dev: true, _build: true })
    const nuxt = await cmd.getNuxt(config)

    // Setup hooks
    nuxt.hook('watch:restart', payload => this.onWatchRestart(payload, { nuxt, cmd, argv }))
    nuxt.hook('bundler:change', changedFileName => this.onBundlerChange(changedFileName))

    // Wait for nuxt to be ready
    await nuxt.ready()

    // Start listening
    await nuxt.server.listen()

    // Show banner when listening
    showBanner(nuxt, false)

    // Opens the server listeners url in the default browser (only once)
    if (argv.open) {
      argv.open = false
      const openerPromises = nuxt.server.listeners.map(listener => opener(listener.url))
      await Promise.all(openerPromises)
    }

    // Return instance
    return nuxt
  },

  async _buildDev (cmd: NuxtCommand, argv: ParsedArgs, nuxt: Nuxt) {
    // Create builder instance
    const builder = await cmd.getBuilder(nuxt)

    // Start Build
    await builder.build()

    // Print memory usage
    showMemoryUsage()

    // Display server urls after the build
    for (const listener of nuxt.server.listeners) {
      consola.info(chalk.bold('Listening on: ') + listener.url)
    }

    // Return instance
    return nuxt
  },

  logChanged ({ event, path }) {
    const { icon, color, action } = eventsMapping[event] || eventsMapping.change

    consola.log({
      type: event,
      icon: chalk[color].bold(icon),
      message: `${action} ${chalk.cyan(formatPath(path))}`
    })
  },

  async onWatchRestart ({ event, path }, { nuxt, cmd, argv }) {
    this.logChanged({ event, path })

    await nuxt.close()

    await this.startDev(cmd, argv)
  },

  onBundlerChange (path: string) {
    this.logChanged({ event: 'change', path })
  }
}
