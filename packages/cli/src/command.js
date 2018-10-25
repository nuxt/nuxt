import parseArgs from 'minimist'
import wrapAnsi from 'wrap-ansi'
import { name, version } from '../package.json'
import { loadNuxtConfig, indent, indentLines, foldLines } from './utils'
import { options as Options, defaultOptions as DefaultOptions } from './options'
import * as imports from './imports'

const startSpaces = 6
const optionSpaces = 2
const maxCharsPerLine = 80

export default class NuxtCommand {
  constructor({ description, usage, options } = {}) {
    this.description = description || ''
    this.usage = usage || ''
    this.options = Array.from(new Set((options || []).concat(DefaultOptions)))
  }

  _getMinimistOptions() {
    const minimistOptions = {
      alias: {},
      boolean: [],
      string: [],
      default: {}
    }

    for (const name of this.options) {
      const option = Options[name]

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

    for (const name of this.options) {
      if (Options[name].handle) {
        Options[name].handle(options, argv)
      }
    }

    return options
  }

  importCore() {
    return imports.core()
  }

  importBuilder() {
    return imports.builder()
  }

  importGenerator() {
    return imports.generator()
  }

  async getNuxt(options) {
    const { Nuxt } = await this.importCore()
    return new Nuxt(options)
  }

  async getBuilder(nuxt) {
    const { Builder } = await this.importBuilder()
    return new Builder(nuxt)
  }

  async getGenerator(nuxt) {
    const { Generator } = await this.importGenerator()
    const { Builder } = await this.importBuilder()
    return new Generator(nuxt, new Builder(nuxt))
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
