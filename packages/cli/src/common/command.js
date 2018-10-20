import parseArgs from 'minimist'
import { loadNuxtConfig, foldLines, indent } from './utils'
import Options from './options'

const startSpaces = 6
const optionSpaces = 2
const maxCharsPerLine = 80

const defaultOptions = [
  'spa',
  'universal',
  'config-file',
  'version',
  'help'
]

export default class Command {
  constructor({ description, usage, options } = {}) {
    this.description = description || ''
    this.usage = usage || ''
    this.options = Array.from(new Set((options || []).concat(defaultOptions)))
  }

  buildMinimistOptions() {
    const minimistOptions = {
      alias: {},
      boolean: [],
      string: [],
      default: {}
    }

    this.options.forEach((name) => {
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
    })

    return minimistOptions
  }

  getArgv(args) {
    const minimistOptions = this.buildMinimistOptions()
    const argv = parseArgs(args || process.argv.slice(2), minimistOptions)

    argv.version && this.showVersion()
    argv.help && this.showHelp()

    return argv
  }

  async getNuxtConfig(argv, extraOptions) {
    const options = Object.assign(await loadNuxtConfig(argv), extraOptions || {})

    for (const name of this.options) {
      if (Options[name].handle) {
        Options[name].handle(options, argv)
      }
    }

    return options
  }

  importCore() {
    return import('@nuxt/core')
  }

  importBuilder(generator) {
    return import('@nuxt/builder')
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
    const { Generator, Builder } = await this.importBuilder()
    return new Generator(nuxt, new Builder(nuxt))
  }

  buildHelp() {
    const options = []

    let maxLength = 0
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

        maxLength = Math.max(maxLength, optionHelp.length)
        options.push([ optionHelp, option.description ])
      }
    }

    const optionTexts = options.reduce((acc, val) => {
      const line = indent(startSpaces) + val[0] +
        indent(maxLength - val[0].length + optionSpaces) + val[1]

      const foldedLines = foldLines(line, maxCharsPerLine, maxLength + startSpaces + optionSpaces)
      return acc + foldedLines.join('\n') + '\n'
    }, '')

    const description = foldLines(this.description, maxCharsPerLine, startSpaces).join('\n')
    return `
    Description
      ${description}
    Usage
      $ nuxt ${this.usage}
    Options
${optionTexts}
`
  }

  showVersion() {
    process.stdout.write('TODO' + '\n')
    process.exit(0)
  }

  showHelp() {
    process.stdout.write(this.buildHelp())
    process.exit(0)
  }
}
