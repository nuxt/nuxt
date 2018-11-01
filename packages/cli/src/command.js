import parseArgs from 'minimist'
import locker from 'proper-lockfile'
import consola from 'consola'
import { name, version } from '../package.json'
import { loadNuxtConfig, getLockPath, defaultLockOptions, isPromise } from './utils'
import { indent, foldLines, startSpaces, optionSpaces } from './formatting'
import * as imports from './imports'

const forceExitAfterSeconds = 5

export default class NuxtCommand {
  constructor({ name, description, usage, options, run, forceExit } = {}) {
    this.name = name || ''
    this.description = description || ''
    this.usage = usage || ''
    this.options = Object.assign({}, options)
    this._run = run
    this.forceExit = typeof forceExit === 'undefined' ? true : forceExit
  }

  static from(options) {
    if (options instanceof NuxtCommand) {
      return options
    }
    return new NuxtCommand(options)
  }

  disableForceExit() {
    this.forceExit = false
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
    const argv = parseArgs(args || process.argv.slice(2), minimistOptions)

    if (argv.version) {
      this.showVersion()
    } else if (argv.help) {
      this.showHelp()
    }

    return argv
  }

  async lock(lockPath, options) {
    const locked = await locker.check(getLockPath(lockPath))
    if (locked) {
      consola.fatal(`A lock already exists on ${lockPath}, cannot continue`)
    }

    options = Object.assign(defaultLockOptions, options || {})
    const lockRelease = await locker.lock(lockPath, options)

    if (!lockRelease) {
      consola.warn(`Unable to get a lock on ${lockPath} (but will continue)`)
    } else if (options.autoUnlock) {
      this.lockRelease = lockRelease
    }

    return lockRelease
  }

  run() {
    let run = this._run(this)

    if (!isPromise(run)) {
      run = Promise.resolve()
    }

    return run
      .then(() => {
        if (this.lockRelease) {
          return this.lockRelease()
        } else {
          return Promise.resolve()
        }
      })
      .then(() => {
        if (this.forceExit) {
          const exitTimeout = setTimeout(() => {
            let msg = `The command 'nuxt ${this.name}' finished but Nuxt did not exit after ${forceExitAfterSeconds}s\n`
            msg += 'This is most likely not caused by a bug in Nuxt\n'
            msg += 'Make sure to wait for all timers you set and stop all listeners, also check any plugin, module, etc you import\n'
            msg += 'If you are developping a custom Nuxt command, call this.disableForceExit() in your run method to prevent the forced exit\n'
            msg += 'Force exiting'
            foldLines(msg, maxCharsPerLine).split('\n').forEach(line => consola.warn(line))
            process.exit(0)
          }, forceExitAfterSeconds * 1000)
          exitTimeout.unref()
        }
      })
      .catch(err => consola.fatal(err))
  }

  async getNuxtConfig(argv, extraOptions) {
    const config = await loadNuxtConfig(argv)
    const options = Object.assign(config, extraOptions || {})

    for (const name of Object.keys(this.options)) {
      if (this.options[name].prepare) {
        this.options[name].prepare(this, options, argv)
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

    for (const name in this.options) {
      const option = this.options[name]

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

    const usage = foldLines(`Usage: nuxt ${this.usage} [options]`, startSpaces)
    const description = foldLines(this.description, startSpaces)
    const opts = foldLines(`Options:`, startSpaces) + '\n\n' + _opts

    return `${usage}\n\n${description}\n\n${opts}\n\n`
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
