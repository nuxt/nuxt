import path from 'path'
import fs from 'fs-extra'
import ignore from 'ignore'

export default class Ignore {
  constructor (options) {
    this.rootDir = options.rootDir
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
        this.ignore = ignore()
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
  }

  filter (paths) {
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
