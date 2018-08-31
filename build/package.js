import { resolve } from 'path'
import { spawnSync } from 'child_process'
import consola from 'consola'
import { readFileSync, existsSync, readJSONSync, writeFileSync, copySync, removeSync } from 'fs-extra'
import { builtinsMap } from './builtins'

const DEFAULTS = {
  distDir: 'dist',
  npmClient: 'yarn',
  buildCommand: 'rollup -c'
}

export default class Package {
  constructor(options) {
    this.options = Object.assign({}, DEFAULTS, options)

    // Use pwd() as rootDir if not specified
    if (!this.options.rootDir) {
      this.options.rootDir = process.cwd()
    }

    // Try to read package.json if not provided
    if (!this.packageObj) {
      this.readPackage()
    }
  }

  get rootDir() {
    return this.options.rootDir
  }

  get packageObj() {
    return this.options.packageObj
  }

  set packageObj(packageObj) {
    this.options.packageObj = packageObj
  }

  get name() {
    return this.packageObj.name
  }

  get version() {
    return this.packageObj.version
  }

  get distDir() {
    return this.resolvePath(this.options.distDir)
  }

  get packagePath() {
    return this.resolvePath('package.json')
  }

  resolvePath(...args) {
    return resolve(this.rootDir, ...args)
  }

  readPackage() {
    if (existsSync(this.packagePath)) {
      this.packageObj = readJSONSync(this.packagePath)
    } else if (!this.packageObj) {
      this.packageObj = {}
    }
    this.logger = consola.withScope(this.name)
  }

  writePackage() {
    consola.log('Writing', this.packagePath)
    writeFileSync(this.packagePath, JSON.stringify(this.packageObj, null, 2) + '\n')
  }

  generateVersion() {
    const date = Math.round(Date.now() / (1000 * 60))
    const gitCommit = this.gitShortCommit()
    const baseVersion = this.packageObj.version.split('-')[0]
    this.packageObj.version = `${baseVersion}-${date}.${gitCommit}`
  }

  build() {
    this.logger.info('Cleanup')
    removeSync(this.distDir)

    this.logger.info('Building')
    this.exec(this.options.npmClient, this.options.buildCommand)
  }

  publish(tag = 'latest') {
    this.logger.info(`publishing ${this.name}@${this.version} with tag ${tag}`)
    this.exec('npm', `publish --tag ${tag}`)
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
      // Ignore builtin modules
      if (builtins[name]) {
        delete dependencies[name]
        continue
      }
      // Try sources
      for (const source of sources) {
        const sourceDeps = source.packageObj.dependencies
        if (sourceDeps && sourceDeps[name]) {
          dependencies[name] = sourceDeps[name]
          break
        }
      }
      // Try to require package.json of dependency
      if (dependencies[name] === null) {
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

    this.packageObj.dependencies = dependencies
  }

  exec(command, args) {
    const r = spawnSync(command, args.split(' '), { cwd: this.rootDir })

    const fullCommand = command + ' ' + args

    if (r.error) {
      this.logger.error(fullCommand, r.error)
    } else {
      this.logger.success(fullCommand, r.output.join('\n'))
    }

    return r
  }

  gitShortCommit() {
    return this.exec('git', 'rev-parse --short HEAD').stdout
  }

  gitBranch() {
    return this.exec('git', 'rev-parse --abbrev-ref HEAD').stdout
  }
}
