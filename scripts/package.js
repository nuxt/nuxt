import { resolve } from 'path'
import EventEmitter from 'events'
import consola from 'consola'
import { sync as spawnSync } from 'cross-spawn'
import { existsSync, readJSONSync, writeFileSync, copySync, removeSync } from 'fs-extra'
import _ from 'lodash'
import { rollup, watch } from 'rollup'
import glob from 'glob'
import sortPackageJson from 'sort-package-json'

import rollupConfig from './rollup.config'

const DEFAULTS = {
  rootDir: process.cwd(),
  pkgPath: 'package.json',
  configPath: 'package.js',
  distDir: 'dist',
  build: false,
  suffix: process.env.PACKAGE_SUFFIX ? `-${process.env.PACKAGE_SUFFIX}` : ''
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

  tryRequire(id) {
    try {
      return require(id)
    } catch (e) {}
  }

  suffixAndVersion() {
    this.logger.info(`Adding suffix ${this.options.suffix}`)

    // Add suffix to the package name
    if (!this.pkg.name.includes(this.options.suffix)) {
      this.pkg.name += this.options.suffix
    }

    // Apply suffix to all linkedDependencies
    for (const oldName of (this.options.linkedDependencies || [])) {
      const name = oldName + this.options.suffix
      const version = this.pkg.dependencies[oldName] || this.pkg.dependencies[name]

      delete this.pkg.dependencies[oldName]
      this.pkg.dependencies[name] = version
    }

    this.generateVersion()
  }

  syncLinkedDependencies() {
    // Apply suffix to all linkedDependencies
    for (const _name of (this.options.linkedDependencies || [])) {
      const name = _name + (this.options.suffix || '')

      // Try to read pkg
      const pkg = this.tryRequire(`${name}/package.json`) ||
        this.tryRequire(`${_name}/package.json`)

      // Skip if pkg or dependency not found
      if (!pkg || !this.pkg.dependencies[name]) {
        this.logger.warn(
          `Could not find linked dependency ${name}`,
          'Did you forgot to removed it from linkedDependencies?'
        )
        continue
      }

      // Current version
      const currentVersion = this.pkg.dependencies[name]
      const caret = currentVersion[0] === '^'

      // Sync version
      this.pkg.dependencies[name] = caret ? `^${pkg.version}` : pkg.version
    }
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

  async build(options = {}, _watch = false) {
    this.emit('build:before')

    // Extend options
    const replace = Object.assign({}, options.replace)
    const alias = Object.assign({}, options.alias)

    // Replace linkedDependencies with their suffixed version
    if (this.options.suffix && this.options.suffix.length) {
      for (const _name of (this.options.linkedDependencies || [])) {
        const name = _name + this.options.suffix
        if (replace[_name] === undefined) {
          replace[_name] = name
        }
        if (alias[_name] === undefined) {
          alias[_name] = name
        }
      }
    }

    const config = rollupConfig({
      rootDir: this.options.rootDir,
      ...options,
      replace,
      alias
    }, this.pkg)

    if (_watch) {
      // Watch
      const watcher = watch(config)
      watcher.on('event', (event) => {
        switch (event.code) {
          // The watcher is (re)starting
          case 'START': return this.logger.debug('Watching for changes')

          // Building an individual bundle
          case 'BUNDLE_START': return this.logger.debug('Building bundle')

          // Finished building a bundle
          case 'BUNDLE_END': return

          // Finished building all bundles
          case 'END':
            this.emit('build:done')
            return this.logger.success('Bundle built')

          // Encountered an error while bundling
          case 'ERROR': return this.logger.error(event.error)

          // Eencountered an unrecoverable error
          case 'FATAL': return this.logger.fatal(event.error)

          // Unknown event
          default: return this.logger.info(JSON.stringify(event))
        }
      })
    } else {
      // Build
      this.logger.info('Building bundle')
      try {
        const bundle = await rollup(config)
        removeSync(config.output.dir)
        await bundle.write(config.output)
        this.logger.success('Bundle built')
        this.emit('build:done')
      } catch (error) {
        this.logger.error(error)
        throw new Error('Error while building bundle')
      }
    }
  }

  watch(options) {
    return this.build(options, true)
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
    this.pkg = sortPackageJson(this.pkg)
    this.sortDependencies()
  }

  sortDependencies() {
    if (this.pkg.dependencies) {
      this.pkg.dependencies = sortObjectKeys(this.pkg.dependencies)
    }

    if (this.pkg.devDependencies) {
      this.pkg.devDependencies = sortObjectKeys(this.pkg.devDependencies)
    }
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
