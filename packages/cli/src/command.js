
import path from 'path'
import consola from 'consola'
import minimist from 'minimist'
import { name, version } from '../package.json'
import { forceExit } from './utils'
import { loadNuxtConfig } from './utils/config'
import { indent, foldLines, colorize } from './utils/formatting'
import { startSpaces, optionSpaces, forceExitTimeout } from './utils/constants'
import { detectTypeScript } from './utils/typescript'
import * as imports from './imports'

export default class NuxtCommand {
  /*    
    The "argv" array contains everything given on the command line. 
    The first item (argv[0]) will be the path to node itself, 
    and the second item (argv[1]) will be the path to your script code.

    So a slice starting at 2 will discard both of those 
    and return everything else that was typed on the command line. 
    These are the arguments that will be used to construct the API query string.
  */ 
  // Node 위치와 file 위치를 제외한 argv 옵션들
  constructor(cmd = { name: '', usage: '', description: '' }, argv = process.argv.slice(2)) {
    
    if (!cmd.options) {
      cmd.options = {}
    }
    this.cmd = cmd

    this._argv = Array.from(argv)
    this._parsedArgv = null // Lazy evaluate
  }

  static run(cmd, argv) {
    return NuxtCommand.from(cmd, argv).run()
  }

  // 가져온 cmd와 argv로 cmd는 뭔지, process.argv로 넘어온 옵션은 뭔지 NuxtCommand를 생성할 때 넣음 
  static from(cmd, argv) {
    if (cmd instanceof NuxtCommand) {
      return cmd
    }
    return new NuxtCommand(cmd, argv)
  }

  async run() {
    if (this.argv.help) {
      this.showHelp()
      return
    }

    if (this.argv.version) {
      this.showVersion()
      return
    }

    if (typeof this.cmd.run !== 'function') {
      return
    }

    let cmdError

    try {
      await this.cmd.run(this)
    } catch (e) {
      cmdError = e
    }

    if (this.argv.lock) {
      await this.releaseLock()
    }

    if (this.argv['force-exit']) {
      const forceExitByUser = this.isUserSuppliedArg('force-exit')
      if (cmdError) {
        consola.fatal(cmdError)
      }
      forceExit(this.cmd.name, forceExitByUser ? false : forceExitTimeout)
      if (forceExitByUser) {
        return
      }
    }

    if (cmdError) {
      throw cmdError
    }
  }

  showVersion() {
    process.stdout.write(`${name} v${version}\n`)
  }

  showHelp() {
    process.stdout.write(this._getHelp())
  }

  // minimist 돌려서 argv 돌려주는 getter
  get argv() {
    if (!this._parsedArgv) {
      const minimistOptions = this._getMinimistOptions()
      this._parsedArgv = minimist(this._argv, minimistOptions)
    }
    return this._parsedArgv
  }

  async getNuxtConfig(extraOptions = {}) {
    // ???
    const rootDir = path.resolve(this.argv._[0] || '.')

    // Typescript support
    extraOptions._typescript = await detectTypeScript(rootDir, {
      transpileOnly: this.cmd.name === 'start'
    })

    const config = await loadNuxtConfig(this.argv)
    const options = Object.assign(config, extraOptions)

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

  async setLock(lockRelease) {
    if (lockRelease) {
      if (this._lockRelease) {
        consola.warn(`A previous unreleased lock was found, this shouldn't happen and is probably an error in 'nuxt ${this.cmd.name}' command. The lock will be removed but be aware of potential strange results`)

        await this.releaseLock()
        this._lockRelease = lockRelease
      } else {
        this._lockRelease = lockRelease
      }
    }
  }

  async releaseLock() {
    if (this._lockRelease) {
      await this._lockRelease()
      this._lockRelease = undefined
    }
  }

  isUserSuppliedArg(option) {
    return this._argv.includes(`--${option}`) || this._argv.includes(`--no-${option}`)
  }

  _getDefaultOptionValue(option) {
    // 자료의 타입을 반환
    return typeof option.default === 'function' ? option.default(this.cmd) : option.default
  }

  _getMinimistOptions() {
    const minimistOptions = {
      alias: {},
      boolean: [],
      string: [],
      default: {}
    }

    // Object.keys는 배열이나 오브젝트의 인덱스나 키를 반환함
    for (const name of Object.keys(this.cmd.options)) {
      // option 
      // options들 중에 key를 option으로 넣고, 그 키로 다시 option 값 가져옴
      const option = this.cmd.options[name] // 예, name이 analyze라면

      if (option.alias) { // name
        minimistOptions.alias[option.alias] = name
      }
      if (option.type) {
        minimistOptions[option.type].push(option.alias || name)
      }
      if (option.default) {
        minimistOptions.default[option.alias || name] = this._getDefaultOptionValue(option)
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
      optionHelp += option.type === 'boolean' && this._getDefaultOptionValue(option) ? 'no-' : ''
      optionHelp += name
      if (option.alias) {
        optionHelp += `, -${option.alias}`
      }

      maxOptionLength = Math.max(maxOptionLength, optionHelp.length)
      options.push([optionHelp, option.description])
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
