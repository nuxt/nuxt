import { resolve } from 'path'
import consola from 'consola'
import spawn from 'cross-spawn'
import { existsSync, readJSONSync, writeFile, copy, remove } from 'fs-extra'
import _ from 'lodash'
import { rollup, watch } from 'rollup'
import _glob from 'glob'
import pify from 'pify'
import sortPackageJson from 'sort-package-json'

import rollupConfig from './rollup.config'

const DEFAULTS = {
  rootDir: process.cwd(),
  pkgPath: 'package.json',
  configPath: 'package.js',
  distDir: 'dist',
  build: false,
  suffix: process.env.PACKAGE_SUFFIX ? `-${process.env.PACKAGE_SUFFIX}` : '',
  hooks: {}
}

const glob = pify(_glob)

const sortObjectKeys = obj => _(obj).toPairs().sortBy(0).fromPairs().value()

export default class Package {
  constructor (options) {
    // Assign options
    this.options = Object.assign({}, DEFAULTS, options)

    // Basic logger
    this.logger = consola

    // Init (sync)
    this._init()
  }

  _init () {
    // Try to read package.json
    this.readPkg()

    // Use tagged logger
    this.logger = consola.withTag(this.pkg.name)

    // Try to load config
    this.loadConfig()
  }

  resolvePath (...args) {
    return resolve(this.options.rootDir, ...args)
  }

  readPkg () {
    this.pkg = readJSONSync(this.resolvePath(this.options.pkgPath))
  }

  loadConfig () {
    const configPath = this.resolvePath(this.options.configPath)

    if (existsSync(configPath)) {
      let config = require(configPath)
      config = config.default || config

      Object.assign(this.options, config)
    }
  }

  async callHook (name, ...args) {
    let fns = this.options.hooks[name]

    if (!fns) {
      return
    }

    if (!Array.isArray(fns)) {
      fns = [fns]
    }

    for (const fn of fns) {
      await fn(this, ...args)
    }
  }

  load (relativePath, opts) {
    return new Package(Object.assign({
      rootDir: this.resolvePath(relativePath)
    }, opts))
  }

  async writePackage () {
    if (this.options.sortDependencies) {
      this.sortDependencies()
    }
    const pkgPath = this.resolvePath(this.options.pkgPath)
    this.logger.debug('Writing', pkgPath)
    await writeFile(pkgPath, JSON.stringify(this.pkg, null, 2) + '\n')
  }

  generateVersion () {
    const date = Math.round(Date.now() / (1000 * 60))
    const gitCommit = this.gitShortCommit()
    const baseVersion = this.pkg.version.split('-')[0]
    this.pkg.version = `${baseVersion}-${date}.${gitCommit}`
  }

  tryRequire (id) {
    try {
      return require(id)
    } catch (e) {
    }
  }

  suffixAndVersion () {
    this.logger.info(`Adding suffix ${this.options.suffix}`)

    const oldPkgName = this.pkg.name

    // Add suffix to the package name
    if (!oldPkgName.includes(this.options.suffix)) {
      this.pkg.name += this.options.suffix
    }

    // Apply suffix to all linkedDependencies
    if (this.pkg.dependencies) {
      for (const oldName of (this.options.linkedDependencies || [])) {
        const name = oldName + this.options.suffix
        const version = this.pkg.dependencies[oldName] || this.pkg.dependencies[name]

        delete this.pkg.dependencies[oldName]
        this.pkg.dependencies[name] = version
      }
    }

    if (typeof this.pkg.bin === 'string') {
      const { bin } = this.pkg
      this.pkg.bin = {
        [oldPkgName]: bin,
        [this.pkg.name]: bin
      }
    }

    this.generateVersion()
  }

  syncLinkedDependencies () {
    // Apply suffix to all linkedDependencies
    for (const _name of (this.options.linkedDependencies || [])) {
      const name = _name + (this.options.suffix || '')

      // Try to read pkg
      const pkg = this.tryRequire(`${name}/package.json`) ||
        this.tryRequire(`${_name}/package.json`)

      // Skip if pkg or dependency not found
      if (!pkg || !this.pkg.dependencies || !this.pkg.dependencies[name]) {
        continue
      }

      // Current version
      const currentVersion = this.pkg.dependencies[name]
      const caret = currentVersion[0] === '^'

      // Sync version
      this.pkg.dependencies[name] = caret ? `^${pkg.version}` : pkg.version
    }
  }

  async getWorkspacePackages () {
    const packages = []

    for (const workspace of this.pkg.workspaces || []) {
      const dirs = await glob(workspace)
      for (const dir of dirs) {
        if (existsSync(this.resolvePath(dir, 'package.json'))) {
          const pkg = new Package({ rootDir: this.resolvePath(dir) })
          packages.push(pkg)
        } else {
          consola.warn('Invalid workspace package:', dir)
        }
      }
    }

    return packages
  }

  async build (_watch = false) {
    // Prepare rollup config
    const config = {
      rootDir: this.options.rootDir,
      alias: {},
      replace: {},
      ...this.options.rollup
    }

    // Replace linkedDependencies with their suffixed version
    if (this.options.suffix && this.options.suffix.length) {
      for (const _name of (this.options.linkedDependencies || [])) {
        const name = _name + this.options.suffix
        config.replace[`'${_name}'`] = `'${name}'`
        config.alias[_name] = name
      }
    }

    // Allow extending config
    await this.callHook('build:extend', { config })

    // Create rollup config
    const _rollupConfig = rollupConfig(config, this.pkg)

    // Allow extending rollup config
    await this.callHook('build:extendRollup', {
      rollupConfig: _rollupConfig
    })

    if (_watch) {
      // Watch
      const watcher = watch(_rollupConfig)
      watcher.on('event', (event) => {
        switch (event.code) {
          // The watcher is (re)starting
          case 'START':
            return this.logger.debug('Watching for changes')

          // Building an individual bundle
          case 'BUNDLE_START':
            return this.logger.debug('Building bundle')

          // Finished building a bundle
          case 'BUNDLE_END':
            return

          // Finished building all bundles
          case 'END':
            return this.logger.success('Bundle built')

          // Encountered an error while bundling
          case 'ERROR':
            this.formatError(event.error)
            return this.logger.error(event.error)

          // Unknown event
          default:
            return this.logger.info(JSON.stringify(event))
        }
      })
    } else {
      // Build
      this.logger.info('Building bundle')
      try {
        const bundle = await rollup(_rollupConfig)
        await remove(_rollupConfig.output.dir)
        await bundle.write(_rollupConfig.output)

        this.logger.success('Bundle built')
        await this.callHook('build:done', { bundle })

        // Analyze bundle imports against pkg
        // if (this.pkg.dependencies) {
        //   const dependencies = {}
        //   for (const dep in this.pkg.dependencies) {
        //     dependencies[dep] = this.pkg.dependencies[dep]
        //   }
        //   for (const imp of bundle.imports) {
        //     delete dependencies[imp]
        //   }
        //   for (const dep in dependencies) {
        //     this.logger.warn(`Unused dependency ${dep}@${dependencies[dep]}`)
        //   }
        // }
      } catch (err) {
        this.formatError(err)
        this.logger.error(err)
        throw err
      }
    }
  }

  formatError (error) {
    let loc = this.options.rootDir
    if (error.loc) {
      const { file, column, line } = error.loc
      loc = `${file}:${line}:${column}`
    }
    error.message = `[${error.code}] ${error.message}\nat ${loc}`
    return error
  }

  watch () {
    return this.build(true)
  }

  publish (tag = 'latest') {
    this.logger.info(`publishing ${this.pkg.name}@${this.pkg.version} with tag ${tag}`)
    this.exec('npm', `publish --tag ${tag}`)
  }

  copyFieldsFrom (source, fields = []) {
    for (const field of fields) {
      this.pkg[field] = source.pkg[field]
    }
  }

  async copyFilesFrom (source, files) {
    for (const file of files || source.pkg.files || []) {
      const src = resolve(source.options.rootDir, file)
      const dst = resolve(this.options.rootDir, file)
      await copy(src, dst)
    }
  }

  autoFix () {
    this.pkg = sortPackageJson(this.pkg)
    this.sortDependencies()
  }

  sortDependencies () {
    if (this.pkg.dependencies) {
      this.pkg.dependencies = sortObjectKeys(this.pkg.dependencies)
    }

    if (this.pkg.devDependencies) {
      this.pkg.devDependencies = sortObjectKeys(this.pkg.devDependencies)
    }
  }

  exec (command, args, silent = false) {
    const r = spawn.sync(command, args.split(' '), { cwd: this.options.rootDir, env: process.env })

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

  gitShortCommit () {
    const { stdout } = this.exec('git', 'rev-parse --short HEAD', true)
    return stdout
  }

  gitBranch () {
    const { stdout } = this.exec('git', 'rev-parse --abbrev-ref HEAD', true)
    return stdout
  }
}
