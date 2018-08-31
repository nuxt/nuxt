import { resolve } from 'path'
import { spawnSync } from 'child_process'
import consola from 'consola'
import { readFileSync, existsSync, readJSONSync, writeFileSync, copySync } from 'fs-extra'
import { builtinsMap } from './builtins'

export default class Package {
  constructor(options) {
    this.options = Object.assign({}, options)

    // Use pwd() as rootDir if not specified
    if (!this.options.rootDir) {
      this.options.rootDir = process.cwd()
    }

    // Try to read package.json if not provided
    if (!this.packageObj) {
      this.readPackage()
    }
  }

  get packageObj() {
    return this.options.packageObj
  }

  set packageObj(packageObj) {
    this.options.packageObj = packageObj
  }

  get packagePath() {
    return resolve(this.options.rootDir, 'package.json')
  }

  readPackage() {
    if (existsSync(this.packagePath)) {
      this.packageObj = readJSONSync(this.packagePath)
    } else if (!this.packageObj) {
      this.packageObj = {}
    }
  }

  writePackage() {
    writeFileSync(this.packagePath, JSON.stringify(this.packageObj, null, 2) + '\n')
  }

  generateVersion() {
    const date = Math.round(Date.now() / (1000 * 60))
    const gitCommit = this._gitShortCommit()
    const baseVersion = this.packageObj.version.split('-')[0]
    this.packageObj.version = `${baseVersion}-${date}.${gitCommit}`
  }

  publish(tag = 'latest') {
    consola.log(`publishing ${this.packageObj.name}@${this.packageObj.version} with tag ${tag}`)
    const result = this._exec('npm', `publish --tag ${tag}`)
    return result
  }

  copyFieldsFrom(source, fields = []) {
    for (const field of fields) {
      this.packageObj[field] = source.packageObj[field]
    }
  }

  copyFilesFrom(source, files) {
    if (!files) {
      files = source.packageObj.files || []
    }

    for (const file of files) {
      const src = resolve(source.options.rootDir, file)
      const dst = resolve(this.options.rootDir, file)
      copySync(src, dst)
    }
  }

  updateDependencies({ dist, sources = [], extras = [], exclude = [] }) {
    const dependencies = {}
    const requireRegex = /require\('([-@/\w]+)'\)/g

    // Extras
    for (const name of extras) {
      dependencies[name] = null
    }

    // Scan require() calls inside dist
    const distSource = readFileSync(resolve(this.options.rootDir, dist))

    let match = requireRegex.exec(distSource)
    while (match) {
      const name = match[1]
      dependencies[name] = null
      match = requireRegex.exec(distSource)
    }

    // Exclude
    for (const name of exclude) {
      delete dependencies[name]
    }

    const builtins = builtinsMap()
    // Resolve dependency versions
    for (const name in dependencies) {
      if (!dependencies[name]) {
        // Ignore builtin modules
        if (builtins[name]) {
          delete dependencies[name]
          continue
        }
        // Try sources
        for (const source of sources) {
          if (source.packageObj.dependencies && source.packageObj.dependencies[name]) {
            dependencies[name] = source.packageObj.dependencies[name]
            break
          }
        }
        // Try to require package.json of dependency
        if (!dependencies[name]) {
          try {
            const _pkg = require(`${name}/package.json`)
            if (!_pkg.version) {
              throw Error('No version specified')
            }
            dependencies[name] = `^${_pkg.version}`
          } catch (e) {
            consola.warn(e)
            delete dependencies[name]
          }
        }
      }
    }

    this.packageObj.dependencies = dependencies
  }

  _exec(command, args) {
    const r = spawnSync(command, args.split(' '), { cwd: this.options.rootDir })

    const result = r.stdout.trim()
    result.status = r.status

    return result
  }

  _gitShortCommit() {
    return this._exec('git', 'rev-parse --short HEAD')
  }

  _gitBranch() {
    return this._exec('git', 'rev-parse --abbrev-ref HEAD')
  }
}
