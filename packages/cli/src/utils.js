import path from 'path'
import { existsSync } from 'fs'
import consola from 'consola'
import esm from 'esm'
import prompts from 'prompts'
import spawn from 'cross-spawn'
import defaultsDeep from 'lodash/defaultsDeep'
import { getDefaultNuxtConfig } from '@nuxt/config'

const _require = esm(module, {
  cache: false,
  cjs: {
    cache: true,
    vars: true,
    namedExports: true
  }
})

const getRootDir = argv => path.resolve(argv._[0] || '.')
const getNuxtConfigFile = argv => path.resolve(getRootDir(argv), argv['config-file'])

export async function loadNuxtConfig(argv) {
  const rootDir = getRootDir(argv)
  const nuxtConfigFile = getNuxtConfigFile(argv)

  let options = {}

  if (existsSync(nuxtConfigFile)) {
    delete require.cache[nuxtConfigFile]
    options = _require(nuxtConfigFile) || {}
    if (options.default) {
      options = options.default
    }

    if (typeof options === 'function') {
      try {
        options = await options()
        if (options.default) {
          options = options.default
        }
      } catch (error) {
        consola.error(error)
        consola.fatal('Error while fetching async configuration')
      }
    }
  } else if (argv['config-file'] !== 'nuxt.config.js') {
    consola.fatal('Could not load config file: ' + argv['config-file'])
  }
  if (typeof options.rootDir !== 'string') {
    options.rootDir = rootDir
  }

  // Nuxt Mode
  options.mode =
    (argv.spa && 'spa') || (argv.universal && 'universal') || options.mode

  // Server options
  options.server = defaultsDeep({
    port: argv.port || undefined,
    host: argv.hostname || undefined,
    socket: argv['unix-socket'] || undefined
  }, options.server || {}, getDefaultNuxtConfig().server)

  return options
}

export async function interactiveEdgeInstall() {
  const response = await prompts([{
    type: 'toggle',
    name: 'install',
    message: 'The nuxt-edge packages are not yet installed, ' +
      'do you wish to install them?',
    initial: true,
    active: 'yes',
    inactive: 'no'
  }, {
    type: prev => prev ? 'select' : null,
    name: 'manager',
    message: 'Which package manager do you use?',
    initial: 0,
    choices: [
      { title: 'yarn', value: 'yarn' },
      { title: 'npm', value: 'npm' }
    ]
  }, {
    type: prev => prev ? 'toggle' : null,
    name: 'dev',
    message: 'Install as dev dependencies?',
    initial: true,
    active: 'yes',
    inactive: 'no'
  }])

  if (response.install) {
    return new Promise((resolve, reject) => {
      const args = []
      args.push(response.manager === 'yarn' ? 'add' : 'install')

      if (response.dev) {
        args.push(response.manager === 'yarn' ? '--dev' : '--save-dev')
      }

      Array.prototype.push.apply(args, [
        '@nuxt/core-edge',
        '@nuxt/builder-edge',
        '@nuxt/webpack-edge',
        '@nuxt/generator-edge'
      ])

      consola.info(`Starting nuxt-edge install\n$ ${response.manager} ${args.join(' ')}`)
      const cp = spawn(response.manager, args, {
        stdio: ['ignore', 'inherit', 'inherit']
      })

      cp.on('error', () => {
        consola.error('An error occured during edge package install')
        resolve()
      })

      cp.on('close', (code) => {
        if (code) {
          consola.warn(`${response.manager} exited with a non-zero exit code`)
        } else {
          consola.success('Nuxt edge packages installed succesfully')
        }
        resolve()
      })
    })
  }
}
