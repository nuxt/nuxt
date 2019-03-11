import path from 'path'
import { existsSync } from 'fs'
import consola from 'consola'
import esm from 'esm'
import exit from 'exit'
import defaultsDeep from 'lodash/defaultsDeep'
import { defaultNuxtConfigFile, getDefaultNuxtConfig } from '@nuxt/config'
import { lock } from '@nuxt/utils'
import chalk from 'chalk'
import prettyBytes from 'pretty-bytes'
import env from 'std-env'
import { successBox, warningBox } from './formatting'

export const requireModule = process.env.NUXT_TS ? require : esm(module, {
  cache: false,
  cjs: {
    cache: true,
    vars: true,
    namedExports: true
  }
})

export const eventsMapping = {
  add: { icon: '+', color: 'green', action: 'Created' },
  change: { icon: env.windows ? '»' : '↻', color: 'blue', action: 'Updated' },
  unlink: { icon: '-', color: 'red', action: 'Removed' }
}

const getRootDir = argv => path.resolve(argv._[0] || '.')
const getNuxtConfigFile = argv => path.resolve(getRootDir(argv), argv['config-file'])

export async function loadNuxtConfig(argv) {
  const rootDir = getRootDir(argv)
  const nuxtConfigFile = getNuxtConfigFile(argv)

  let options = {}

  if (existsSync(nuxtConfigFile)) {
    delete require.cache[nuxtConfigFile]
    options = requireModule(nuxtConfigFile) || {}
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

    // Keep _nuxtConfigFile for watching
    options._nuxtConfigFile = nuxtConfigFile
  } else if (argv['config-file'] !== defaultNuxtConfigFile) {
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

export function showBanner(nuxt) {
  if (env.test) {
    return
  }

  if (env.minimalCLI) {
    for (const listener of nuxt.server.listeners) {
      consola.info('Listening on: ' + listener.url)
    }
    return
  }

  const titleLines = []
  const messageLines = []

  // Name and version
  titleLines.push(`${chalk.green.bold('Nuxt.js')} ${nuxt.constructor.version}`)

  // Running mode
  titleLines.push(`Running in ${nuxt.options.dev ? chalk.bold.blue('development') : chalk.bold.green('production')} mode (${chalk.bold(nuxt.options.mode)})`)

  // https://nodejs.org/api/process.html#process_process_memoryusage
  const { heapUsed, rss } = process.memoryUsage()
  titleLines.push(`Memory usage: ${chalk.bold(prettyBytes(heapUsed))} (RSS: ${prettyBytes(rss)})`)

  // Listeners
  for (const listener of nuxt.server.listeners) {
    messageLines.push(chalk.bold('Listening on: ') + chalk.underline.blue(listener.url))
  }

  // Add custom badge messages
  if (nuxt.options.cli.badgeMessages.length) {
    messageLines.push('', ...nuxt.options.cli.badgeMessages)
  }

  process.stdout.write(successBox(messageLines.join('\n'), titleLines.join('\n')))
}

export function formatPath(filePath) {
  if (!filePath) {
    return
  }
  return filePath.replace(process.cwd() + path.sep, '')
}

/**
 * Normalize string argument in command
 *
 * @export
 * @param {String} argument
 * @param {*} defaultValue
 * @returns formatted argument
 */
export function normalizeArg(arg, defaultValue) {
  switch (arg) {
    case 'true': arg = true; break
    case '': arg = true; break
    case 'false': arg = false; break
    case undefined: arg = defaultValue; break
  }
  return arg
}

export function forceExit(cmdName, timeout) {
  if (timeout !== false) {
    const exitTimeout = setTimeout(() => {
      const msg = `The command 'nuxt ${cmdName}' finished but did not exit after ${timeout}s
This is most likely not caused by a bug in Nuxt.js
Make sure to cleanup all timers and listeners you or your plugins/modules start.
Nuxt.js will now force exit

${chalk.bold('DeprecationWarning: Starting with Nuxt version 3 this will be a fatal error')}`

      // TODO: Change this to a fatal error in v3
      process.stderr.write(warningBox(msg))
      exit(0)
    }, timeout * 1000)
    exitTimeout.unref()
  } else {
    exit(0)
  }
}

// An immediate export throws an error when mocking with jest
// TypeError: Cannot set property createLock of #<Object> which has only a getter
export function createLock(...args) {
  return lock(...args)
}
