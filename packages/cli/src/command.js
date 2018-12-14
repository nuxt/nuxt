
import { resolve, parse } from 'path'
import { readdirSync, existsSync } from 'fs'
import parseArgs from 'minimist'
import commandExists from 'command-exists'
import { name, version } from '../package.json'
import { requireModule, loadNuxtConfig } from './utils'
import { indent, foldLines, startSpaces, optionSpaces, colorize } from './utils/formatting'
import * as commands from './commands'
import * as imports from './imports'

export default class NuxtCommand {
  constructor(cmd = { name: '', usage: '', description: '', options: {} }) {
    this.cmd = cmd
  }

  static ensure(name, module = null) {
    if (module === null) {
      if (!(name in commands)) {
        throw new Error(`Command ${name} could not be loaded!`)
      }
      return
    }
    if (!await commandExists(`${module}-${name}`)) {
      throw new Error(`Command ${name} could not be loaded!`)
    }
  }

  static async load(name, dir = null) {
    if (dir !== null) {
      const cmdPath = resolve(dir, 'commands', `${name}.js`)
      return NuxtCommand.from(requireModule(cmdPath).default)
    }
    // eslint-disable-next-line import/namespace
    const cmd = await commands[name]().then(m => m.default)
    return NuxtCommand.from(cmd)
  }

  static from(options) {
    if (options instanceof NuxtCommand) {
      return options
    }
    return new NuxtCommand(options)
  }

  run() {
    return this.cmd.run(this)
  }

  showVersion() {
    process.stdout.write(`${name} v${version}\n`)
    process.exit(0)
  }

  showHelp() {
    process.stdout.write(this._getHelp())
    process.exit(0)
  }

  getArgv(args) {
    const minimistOptions = this._getMinimistOptions()
    const argv = parseArgs(args || process.argv.slice(2), minimistOptions)

    if (argv.version) {
      this.showVersion()
    } else if (argv.help) {
      this.showHelp()
    }

    return argv
  }

  async getNuxtConfig(argv, extraOptions) {
    const config = await loadNuxtConfig(argv)
    const options = Object.assign(config, extraOptions || {})

    for (const name of Object.keys(this.cmd.options)) {
      this.cmd.options[name].prepare && this.cmd.options[name].prepare(this, options, argv)
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
