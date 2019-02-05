
import minimist from 'minimist'
import env from 'std-env'
import { name, version } from '../package.json'
import { loadNuxtConfig } from './utils'
import { indent, foldLines, colorize, warningBox } from './utils/formatting'
import { startSpaces, optionSpaces } from './utils/settings'
import * as imports from './imports'

const forceExitAfterSeconds = 5

export default class NuxtCommand {
  constructor(cmd = { name: '', usage: '', description: '' }, argv = process.argv.slice(2)) {
    if (!cmd.options) {
      cmd.options = {}
    }
    this.cmd = cmd

    // If the cmd is a server then dont forcibly exit when the cmd is finished
    this.isServer = cmd.isServer !== undefined ? cmd.isServer : Boolean(this.cmd.options.hostname)
    this.forceExit = !this.isServer && !env.test

    this._argv = Array.from(argv)
    this._parsedArgv = null // Lazy evaluate
  }

  static run(cmd, argv) {
    return NuxtCommand.from(cmd, argv).run()
  }

  static from(cmd, argv) {
    if (cmd instanceof NuxtCommand) {
      return cmd
    }
    return new NuxtCommand(cmd, argv)
  }

  run() {
    if (this.argv.help) {
      this.showHelp()
      return Promise.resolve()
    }

    if (this.argv.version) {
      this.showVersion()
      return Promise.resolve()
    }

    if (typeof this.cmd.run !== 'function') {
      return Promise.resolve()
    }

    return Promise.resolve(this.cmd.run(this))
      .then(() => {
        if (this.forceExit) {
          const exitTimeout = setTimeout(() => {
            let msg = `The command 'nuxt ${this.cmd.name}' finished but Nuxt.js did not exit after ${forceExitAfterSeconds}s\n`
            msg += 'This is most likely not caused by a bug in Nuxt\n'
            msg += 'Make sure to cleanup all timers and listeners you or your plugins/modules start.\n'
            msg += 'Nuxt.js will now force exit'
            process.stderr.write(warningBox(msg))
            process.exit(0)
          }, forceExitAfterSeconds * 1000)
          exitTimeout.unref()
        }
      })
  }

  showVersion() {
    process.stdout.write(`${name} v${version}\n`)
  }

  showHelp() {
    process.stdout.write(this._getHelp())
  }

  get argv() {
    if (!this._parsedArgv) {
      const minimistOptions = this._getMinimistOptions()
      this._parsedArgv = minimist(this._argv, minimistOptions)
    }
    return this._parsedArgv
  }

  async getNuxtConfig(extraOptions) {
    const config = await loadNuxtConfig(this.argv)
    const options = Object.assign(config, extraOptions || {})

    for (const name of Object.keys(this.cmd.options)) {
      this.cmd.options[name].prepare && this.cmd.options[name].prepare(this, options, this.argv)
    }

    return options
  }

  async getNuxt(options) {
    const { Nuxt } = await imports.core()
    const nuxt = new Nuxt(options)
    await nuxt.ready()
    return nuxt
  }

  async getBuilder(nuxt) {
    const { Builder } = await imports.builder()
    const { BundleBuilder } = await imports.webpack()
    return new Builder(nuxt, BundleBuilder)
  }

  async getGenerator(nuxt) {
    const { Generator } = await imports.generator()
    const builder = await this.getBuilder(nuxt)
    return new Generator(nuxt, builder)
  }

  _getMinimistOptions() {
    const minimistOptions = {
      alias: {},
      boolean: [],
      string: [],
      default: {}
    }

    for (const name of Object.keys(this.cmd.options)) {
      const option = this.cmd.options[name]

      if (option.alias) {
        minimistOptions.alias[option.alias] = name
      }
      if (option.type) {
        minimistOptions[option.type].push(option.alias || name)
      }
      if (option.default) {
        minimistOptions.default[option.alias || name] = option.default
      }
    }

    return minimistOptions
  }

  _getHelp() {
    const options = []
    let maxOptionLength = 0

    for (const name in this.cmd.options) {
      const option = this.cmd.options[name]

      let optionHelp = '--'
      optionHelp += option.type === 'boolean' && option.default ? 'no-' : ''
      optionHelp += name
      if (option.alias) {
        optionHelp += `, -${option.alias}`
      }

      maxOptionLength = Math.max(maxOptionLength, optionHelp.length)
      options.push([ optionHelp, option.description ])
    }

    const _opts = options.map(([option, description]) => {
      const i = indent(maxOptionLength + optionSpaces - option.length)
      return foldLines(
        option + i + description,
        startSpaces + maxOptionLength + optionSpaces * 2,
        startSpaces + optionSpaces
      )
    }).join('\n')

    const usage = foldLines(`Usage: nuxt ${this.cmd.usage} [options]`, startSpaces)
    const description = foldLines(this.cmd.description, startSpaces)
    const opts = foldLines(`Options:`, startSpaces) + '\n\n' + _opts

    let helpText = colorize(`${usage}\n\n`)
    if (this.cmd.description) {
      helpText += colorize(`${description}\n\n`)
    }
    if (options.length) {
      helpText += colorize(`${opts}\n\n`)
    }

    return helpText
  }
}
