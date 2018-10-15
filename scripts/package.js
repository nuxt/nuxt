import { resolve } from 'path'
import EventEmitter from 'events'
import consola from 'consola'
import { sync as spawnSync } from 'cross-spawn'
import { readFileSync, existsSync, readJSONSync, writeFileSync, copySync, removeSync } from 'fs-extra'
import _ from 'lodash'
import { rollup } from 'rollup'
import glob from 'glob'

import { builtinsMap } from './builtins'
import rollupConfig from './rollup.config'

const DEFAULTS = {
  rootDir: process.cwd(),

  pkgPath: 'package.json',
  configPath: 'package.js',

  distDir: 'dist',
  buildSuffix: process.env.BUILD_SUFFIX,

  build: false,

  autoFix: true
}

const sortObjectKeys = obj => _(obj).toPairs().sortBy(0).fromPairs().value()

export default class Package extends EventEmitter {
  constructor(options) {
    super()

    // Assign options
    this.options = Object.assign({}, DEFAULTS, options)

    // Initialize
    this.init()
  }

  init() {
    // Try to read package.json
    this.readPkg()

    // Init logger
    this.logger = consola.withScope(this.pkg.name)

    // Try to load config
    this.loadConfig()
  }

  resolvePath(...args) {
    return resolve(this.options.rootDir, ...args)
  }

  readPkg() {
    this.pkg = readJSONSync(this.resolvePath(this.options.pkgPath))
  }

  loadConfig() {
    const configPath = this.resolvePath(this.options.configPath)

    if (existsSync(configPath)) {
      let config = require(configPath)
      config = config.default || config

      Object.assign(this.options, config)

      if (typeof config.extend === 'function') {
        config.extend(this, {
          load: (relativePath, opts) => new Package(Object.assign({
            rootDir: this.resolvePath(relativePath)
          }, opts))
        })
      }
    }
  }

  writePackage() {
    if (this.options.sortDependencies) {
      this.sortDependencies()
    }
    const pkgPath = this.resolvePath(this.options.pkgPath)
    this.logger.debug('Writing', pkgPath)
    writeFileSync(pkgPath, JSON.stringify(this.pkg, null, 2) + '\n')
  }

  generateVersion() {
    const date = Math.round(Date.now() / (1000 * 60))
    const gitCommit = this.gitShortCommit()
    const baseVersion = this.pkg.version.split('-')[0]
    this.pkg.version = `${baseVersion}-${date}.${gitCommit}`
  }

  convertTo(suffix) {
    this.logger.info(`Converting to ${suffix} package`)
    this.addNameSuffix(`-${suffix}`)
    this.generateVersion()
    this.writePackage()
  }

  getWorkspacePackages() {
    const packages = []

    for (const workspace of this.pkg.workspaces || []) {
      const dirs = glob.sync(workspace)
      for (const dir of dirs) {
        const pkg = new Package({
          rootDir: this.resolvePath(dir)
        })
        packages.push(pkg)
      }
    }

    return packages
  }

  addNameSuffix(suffix) {
    if (!this.pkg.name.includes(suffix)) {
      this.pkg.name += suffix
    }
  }

  async build(options, outputOptions) {
    this.emit('build:before')

    if (this.options.buildSuffix) {
      this.convertTo(this.options.buildSuffix)
    }

    this.logger.info('Building')

    // https://rollupjs.org/guide/en#javascript-api
    const bundle = await rollup(rollupConfig({
      rootDir: this.options.rootDir,
      ...options
    }, this.pkg))

    // Write bundle to disk
    const _outputOptions = Object.assign({
      format: 'cjs',
      sourcemap: false,
      dir: this.resolvePath(this.options.distDir),
      file: this.pkg.name + '.js'
    }, outputOptions)

    this.logger.info('Writing bundle to the disk')
    removeSync(_outputOptions.dir)
    await bundle.write(_outputOptions)

    this.emit('build:done')
  }

  publish(tag = 'latest') {
    this.logger.info(`publishing ${this.pkg.name}@${this.pkg.version} with tag ${tag}`)
    this.exec('npm', `publish --tag ${tag}`)
  }

  copyFieldsFrom(source, fields = []) {
    for (const field of fields) {
      this.pkg[field] = source.pkg[field]
    }
  }

  copyFilesFrom(source, files) {
    for (const file of files || source.pkg.files || []) {
      const src = resolve(source.options.rootDir, file)
      const dst = resolve(this.options.rootDir, file)
      copySync(src, dst)
    }
  }

  autoFix() {
    this.sortDependencies()
    this.writePackage()
  }

  sortDependencies() {
    if (this.pkg.dependencies) {
      this.pkg.dependencies = sortObjectKeys(this.pkg.dependencies)
    }

    if (this.pkg.devDependencies) {
      this.pkg.devDependencies = sortObjectKeys(this.pkg.devDependencies)
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
        const sourceDeps = source.pkg.dependencies
        if (sourceDeps && sourceDeps[name]) {
          dependencies[name] = sourceDeps[name]
          break
        }
      }
      // Try to require package.json of dependency
      if (dependencies[name] === null) {
        try {
          const depPkg = require(`${name}/package.json`)
          if (!depPkg) {
            throw Error('No version specified')
          }
          dependencies[name] = `^${depPkg.version}`
        } catch (e) {
          this.logger.warn(e)
          delete dependencies[name]
        }
      }
    }

    this.pkg.dependencies = dependencies
  }

  exec(command, args, silent = false) {
    const r = spawnSync(command, args.split(' '), { cwd: this.options.rootDir }, { env: process.env })

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
