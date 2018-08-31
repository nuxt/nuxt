import { resolve } from 'path'
import { spawnSync } from 'child_process'
import consola from 'consola'
import { readFileSync, existsSync, readJSONSync, writeFileSync, copySync, removeSync } from 'fs-extra'
import { builtinsMap } from './builtins'

const DEFAULTS = {
  distDir: 'dist',
  npmClient: process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
  buildCommand: 'rollup -c'
}

export default class Package {
  constructor(options) {
    Object.assign(this, DEFAULTS, options)

    this.rootDir = this.rootDir || process.cwd()
    this.distDir = this.resolvePath(this.distDir)
    this.packagePath = this.resolvePath('package.json')

    // Try to read package.json if not provided
    if (!this.packageObj) {
      this.readPackage()
    }
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
    this.logger = consola.withScope(this.packageObj.name)
  }

  writePackage() {
    consola.debug('Writing', this.packagePath)
    writeFileSync(this.packagePath, JSON.stringify(this.packageObj, null, 2) + '\n')
  }

  generateVersion() {
    const date = Math.round(Date.now() / (1000 * 60))
    const gitCommit = this.gitShortCommit()
    const baseVersion = this.packageObj.version.split('-')[0]
    this.packageObj.version = `${baseVersion}-${date}.${gitCommit}`
  }

  addNameSuffix(suffix) {
    if (!this.packageObj.name.includes(suffix)) {
      this.packageObj.name += suffix
    }
  }

  build() {
    this.logger.info('Cleanup')
    removeSync(this.distDir)

    this.logger.info('Building')
    this.exec(this.npmClient, this.buildCommand)
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
    if (!files) {
      files = source.packageObj.files || []
    }

    for (const file of files) {
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
          consola.warn(e)
          delete dependencies[name]
        }
      }
    }

    this.packageObj.dependencies = dependencies
  }

  exec(command, args, silent = false) {
    const r = spawnSync(command, args.split(' '), { cwd: this.rootDir })

    if (!silent) {
      const fullCommand = command + ' ' + args
      if (r.error) {
        this.logger.error(fullCommand, r.error)
      } else {
        this.logger.success(fullCommand, r.output.join('\n'))
      }
    }

    return {
      error: r.error,
      pid: r.pid,
      status: r.status,
      signal: r.signal,
      output: r.output.join('\n'),
      stdout: String(r.stdout).trim(),
      stderr: String(r.stderr).trim()
    }
  }

  gitShortCommit() {
    return this.exec('git', 'rev-parse --short HEAD', true).stdout
  }

  gitBranch() {
    return this.exec('git', 'rev-parse --abbrev-ref HEAD', true).stdout
  }
}
