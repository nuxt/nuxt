
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
    argv는 커맨드로 받은 모든 것을 담고 있다.
    첫째의 argv[0]는 node의 경로를, argv[1]는 현재 script code의 경로를 담는다.
    process.argv.slice(2)를 하게 되면, 이 둘 다음의 커맨드 라인에서 받은 내용을 가져온다.
  */
  constructor(cmd = { name: '', usage: '', description: '' }, argv = process.argv.slice(2)) {

    if (!cmd.options) {
      cmd.options = {}
    }
    this.cmd = cmd

    // argv로 내려온 _argv
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
      // 여기에서 부터 시작
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
  

  // minimist 돌려서 argv 돌려주는 getter 연습☆
  get argv() {
    // 위에서 parseArgv 초기화를 null로 했음, 따라서 null 이면 아래의 내용 실행
    if (!this._parsedArgv) {
      //_getMinistOptions에서 리턴받은 값 가져옴
      const minimistOptions = this._getMinimistOptions()
      // process.argv.slice(2)로 넘어온 커맨드 옵션들이랑, minimistOptions된 값 
      this._parsedArgv = minimist(this._argv, minimistOptions)
    }
    return this._parsedArgv
  }

  async getNuxtConfig(extraOptions = {}) {
    // argv에서 첫번째 옵션과 현재 파일을 합친 절대 경로 리턴함
    const rootDir = path.resolve(this.argv._[0] || '.')

    // Typescript support
    // 타입스크립트가 있는 프로젝트인지 아닌지를 판단함
    extraOptions._typescript = await detectTypeScript(rootDir, {
      // cmd의 name이 start이면 Typescript error 검사가 아니라 transpile만
      transpileOnly: this.cmd.name === 'start'
    })

    // nuxtConfig 파일 로드함
    const config = await loadNuxtConfig(this.argv)
    // loadNuxtConfig로 받은 파일과, 위에서 설정한 extraOptions를 합침 Object.assign은 합치는 거임
    const options = Object.assign(config, extraOptions)

    for (const name of Object.keys(this.cmd.options)) {
      // prepare function들 실행, prepare라는 프로퍼티가 있고, 뒤의 인자들 넣어서 각 options name에 맞는 prepare들 실행
      this.cmd.options[name].prepare && this.cmd.options[name].prepare(this, options, this.argv)
    }

    return options
  }

  async getNuxt(options) {
    // imports의 @nuxt/core에서 nuxt.js 가져옴
    const { Nuxt } = await imports.core()

    // options가져와서 Nuxt클래스 생성함
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

  // /command/build.js의 옵션의 형식을 바꿔줌
  _getMinimistOptions() {
    const minimistOptions = {
      alias: { },
      boolean: [],
      string: [],
      default: {}
    }

    // Object.keys는 배열이나 오브젝트의 인덱스나 키를 반환함
    for (const name of Object.keys(this.cmd.options)) {
      // option 
      // options들 중에 key를 option으로 넣고, 그 키로 다시 option 값 가져옴
      const option = this.cmd.options[name] // name = analyze

      if (option.alias) {
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

  _getDefaultOptionValue(option) {
    // 자료의 타입을 반환
    return typeof option.default ? option.default : ''
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
