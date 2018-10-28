import parseArgs from 'minimist'
import wrapAnsi from 'wrap-ansi'
import { name, version } from '../package.json'
import { loadNuxtConfig, indent, indentLines, foldLines } from './utils'
import Options from './options'
import * as imports from './imports'

const startSpaces = 6
const optionSpaces = 2
const maxCharsPerLine = 80

export default class NuxtCommand {
  constructor({ description, usage, options } = {}) {
    this.description = description || ''
    this.usage = usage || ''
    this.options = Object.assign({}, options)
  }

  _getMinimistOptions() {
    const minimistOptions = {
      alias: {},
      boolean: [],
      string: [],
      default: {}
    }

    for (const name of Object.keys(this.options)) {
      const option = this.options[name]

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
    console.log('minimistOptions', minimistOptions)
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

    for (const name of Object.keys(this.options)) {
      if (this.options[name].handle) {
        this.options[name].handle(options, argv)
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
    const optionKeys = Object.keys(this.options)
    for (const name in Options) {
      const option = Options[name]
      if (optionKeys.includes(name)) {
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
