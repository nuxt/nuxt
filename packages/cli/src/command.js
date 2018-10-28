import parseArgs from 'minimist'
import wrapAnsi from 'wrap-ansi'
import { name, version } from '../package.json'
import { loadNuxtConfig, indent, indentLines, foldLines } from './utils'
import * as _Options from './options'
import * as imports from './imports'

const startSpaces = 6
const optionSpaces = 2
const maxCharsPerLine = 80
const Options = { ..._Options }
let customOptions = {}

export default class NuxtCommand {
  constructor({ name, description, usage, options, external, sliceAt } = {}) {
    if (external) {
      this.setupExternal(external)
    } else {
      this.sliceAt = typeof sliceAt === 'undefined' ? 2 : sliceAt
      this.description = description || ''
      this.usage = usage || ''
      this._calcOptions()
    }
  }

  _calcCommands(commands) {
    this.commands = commands.map((command) => {
      command.sliceAt = this.sliceAt + 1
      return command
    })
  }

  _calcOptions(options) {
    let _options = {}
    if (options) {
      if (typeof options === 'object') {
        customOptions = options
        _options = options
      } else if (Array.isArray(options)) {
        _options = options
      }
    } else if (name in Options) {
      _options = Object.assign({}, Options[name], Options.common)
    } else {
      _options = Object.assign({}, Options.common)
    }
    this.options = Object.keys(_options)
  }

  _getMinimistOptions() {
    const minimistOptions = {
      alias: {},
      boolean: [],
      string: [],
      default: {}
    }

    for (let option of this.options) {
      option = options[this.name][option] || options.common[option]
      if (option) {
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
    }

    return minimistOptions
  }

  setupExternal(external) {
    this.sliceAt = 3
    this.description = external.description
    this.usage = `${this.name} ${this.external.name} <command>`
    this._calcCommands()
    this._calcOptions(this.external.options)
    this.isExternal = true
  }

  async run() {
    const commandName = process.argv[this.sliceAt - 1]
    const command = this.commands.find((c) => c.name === commandName)
    const nuxtCommand = NuxtCommand({
      name: command.name, 
      description: command.description, 
      command: command.usage, 
      command: command.options
      sliceAt: this.sliceAt + 1
    })
    return this.commands[command].run(nuxtCommand)
  }

  getArgv(args) {
    const minimistOptions = this._getMinimistOptions()
    const argv = parseArgs(args || process.argv.slice(this.sliceAt), minimistOptions)

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

    for (const name of this.options) {
      if (Options[name].handle) {
        Options[name].handle(options, argv)
      }
    }

    return options
  }

  async getNuxt(options) {
    const { Nuxt } = await imports.core()
    return new Nuxt(options)
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

  _getHelp() {
    const options = []

    let maxOptionLength = 0
    // For consistency Options determines order
    for (const name in Options) {
      const option = Options[name]
      if (this.options.includes(name)) {
        let optionHelp = '--'
        optionHelp += option.type === 'boolean' && option.default ? 'no-' : ''
        optionHelp += name
        if (option.alias) {
          optionHelp += `, -${option.alias}`
        }

        maxOptionLength = Math.max(maxOptionLength, optionHelp.length)
        options.push([ optionHelp, option.description ])
      }
    }

    const optionStr = options.map(([option, description]) => {
      const line = option +
        indent(maxOptionLength + optionSpaces - option.length) +
        wrapAnsi(description, maxCharsPerLine - startSpaces - maxOptionLength - optionSpaces)
      return indentLines(line, startSpaces + maxOptionLength + optionSpaces, startSpaces)
    }).join('\n')

    const description = foldLines(this.description, maxCharsPerLine, startSpaces)

    return `
    Description\n${description}
    Usage
      $ nuxt ${this.usage}
    Options\n${optionStr}\n\n`
  }

  showVersion() {
    process.stdout.write(`${name} v${version}\n`)
    process.exit(0)
  }

  showHelp() {
    process.stdout.write(this._getHelp())
    process.exit(0)
  }
}
