import { resolve } from 'path'
import { spawnSync } from 'child_process'
import EventEmitter from 'events'
import consola from 'consola'
import { readFileSync, existsSync, readJSONSync, writeFileSync, copySync, removeSync } from 'fs-extra'
import { builtinsMap } from './builtins'

const DEFAULTS = {
  distDir: 'dist',
  buildSuffix: Boolean(process.env.BUILD_SUFFIX)
}

export default class Package extends EventEmitter {
  constructor(options) {
    super()

    // Assign options
    Object.assign(this, DEFAULTS, options)

    this.rootDir = this.rootDir || process.cwd()
    this.distDir = this.resolvePath(this.distDir)
    this.packageJS = this.resolvePath('package.js')
    this.packageJSON = this.resolvePath('package.json')

    // Initialize
    this.init()
  }

  init() {
    // Try to read package.json if not provided
    this._readPackage()

    // Init logger
    this.logger = consola.withScope(this.packageObj.name)

    // Try to load package.js
    this._loadPackageJS()
  }

  resolvePath(...args) {
    return resolve(this.rootDir, ...args)
  }

  _readPackage() {
    this.packageObj = readJSONSync(this.packageJSON)
  }

  _loadPackageJS() {
    if (existsSync(this.packageJS)) {
      let fn = require(this.packageJS)
      fn = fn.default || fn
      if (typeof fn === 'function') {
        fn(this, {
          load: (relativeRootDir, opts) => new Package(Object.assign({
            rootDir: resolve(this.rootDir, relativeRootDir)
          }, opts))
        })
      }
    }
  }

  writePackage() {
    this.logger.debug('Writing', this.packageJSON)
    writeFileSync(this.packageJSON, JSON.stringify(this.packageObj, null, 2) + '\n')
  }

  generateVersion() {
    const date = Math.round(Date.now() / (1000 * 60))
    const gitCommit = this.gitShortCommit()
    const baseVersion = this.packageObj.version.split('-')[0]
    this.packageObj.version = `${baseVersion}-${date}.${gitCommit}`
  }

  convertTo(suffix) {
    this.logger.info(`Converting to ${suffix} package`)
    this.addNameSuffix(`-${suffix}`)
    this.generateVersion()
    this.writePackage()
  }

  addNameSuffix(suffix) {
    if (!this.packageObj.name.includes(suffix)) {
      this.packageObj.name += suffix
    }
  }

  build() {
    this.emit('build:before')

    if (this.buildSuffix) {
      this.convertTo(this.buildSuffix)
    }

    this.logger.info('Cleaning up')
    removeSync(this.distDir)

    this.logger.info('Building')
    this.exec('rollup', '-c')

    this.emit('build:done')
  }

  publish(tag = 'latest') {
    this.logger.info(`publishing ${this.packageObj.name}@${this.packageObj.version} with tag ${tag}`)
    this.exec('npm', `publish --tag ${tag}`)
  }

  copyFieldsFrom(source, fields = []) {
    for (const field of fields) {
      this.packageObj[field] = source.packageObj[field]
    }
  }

  copyFilesFrom(source, files) {
    for (const file of files || source.packageObj.files || []) {
      const src = resolve(source.rootDir, file)
      const dst = resolve(this.rootDir, file)
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
    const distSource = readFileSync(resolve(this.rootDir, dist))

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
          this.logger.warn(e)
          delete dependencies[name]
        }
      }
    }

    this.packageObj.dependencies = dependencies
  }

  exec(command, args, silent = false) {
    const r = spawnSync(command, args.split(' '), { cwd: this.rootDir }, { env: process.env })

    if (!silent) {
      const fullCommand = command + ' ' + args
      if (r.error) {
        this.logger.error(fullCommand, r.error)
      } else {
        this.logger.success(fullCommand, r.output)
      }
    }

    return {
      error: r.error,
      pid: r.pid,
      status: r.status,
      signal: r.signal,
      stdout: String(r.stdout).trim(),
      stderr: String(r.stderr).trim(),
      output: (r.output || [])
        .map(l => String(l).trim())
        .filter(l => l.length)
        .join('\n')
    }
  }

  gitShortCommit() {
    return this.exec('git', 'rev-parse --short HEAD', true).stdout
  }

  gitBranch() {
    return this.exec('git', 'rev-parse --abbrev-ref HEAD', true).stdout
  }
}
