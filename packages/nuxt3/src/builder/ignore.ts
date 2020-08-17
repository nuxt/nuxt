import path from 'path'
import fs from 'fs-extra'
import ignore from 'ignore'

type IgnoreInstance = ReturnType<typeof ignore>
type IgnoreOptions = Parameters<typeof ignore>[0]

interface Options {
  rootDir: string
  ignore?: IgnoreInstance
  ignoreArray?: Array<string | IgnoreInstance>
  ignoreOptions?: IgnoreOptions
}

export default class Ignore {
  rootDir: string
  ignore?: IgnoreInstance
  ignoreArray?: Array<string | IgnoreInstance>
  ignoreFile?: string
  ignoreOptions?: IgnoreOptions

  constructor ({ ignoreArray, ignoreOptions, rootDir }: Options) {
    this.rootDir = rootDir
    this.ignoreOptions = ignoreOptions
    this.ignoreArray = ignoreArray
    this.addIgnoresRules()
  }

  static get IGNORE_FILENAME () {
    return '.nuxtignore'
  }

  findIgnoreFile () {
    if (!this.ignoreFile) {
      const ignoreFile = path.resolve(this.rootDir, Ignore.IGNORE_FILENAME)
      if (fs.existsSync(ignoreFile) && fs.statSync(ignoreFile).isFile()) {
        this.ignoreFile = ignoreFile
        this.ignore = ignore(this.ignoreOptions)
      }
    }
    return this.ignoreFile
  }

  readIgnoreFile () {
    if (this.findIgnoreFile()) {
      return fs.readFileSync(this.ignoreFile, 'utf8')
    }
  }

  addIgnoresRules () {
    const content = this.readIgnoreFile()
    if (content) {
      this.ignore.add(content)
    }
    if (this.ignoreArray && this.ignoreArray.length > 0) {
      if (!this.ignore) {
        this.ignore = ignore(this.ignoreOptions)
      }
      this.ignore.add(this.ignoreArray)
    }
  }

  filter (paths: string[]) {
    if (this.ignore) {
      return this.ignore.filter([].concat(paths || []))
    }
    return paths
  }

  reload () {
    delete this.ignore
    delete this.ignoreFile
    this.addIgnoresRules()
  }
}
