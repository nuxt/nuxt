import path from 'path'
import exit from 'exit'

import { lock } from 'src/utils'
import chalk from 'chalk'
import env from 'std-env'
import { warningBox } from './formatting'

export const eventsMapping = {
  add: { icon: '+', color: 'green', action: 'Created' },
  change: { icon: env.windows ? '»' : '↻', color: 'blue', action: 'Updated' },
  unlink: { icon: '-', color: 'red', action: 'Removed' }
}

export function formatPath (filePath) {
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
export function normalizeArg (arg, defaultValue) {
  switch (arg) {
    case 'true': arg = true; break
    case '': arg = true; break
    case 'false': arg = false; break
    case undefined: arg = defaultValue; break
  }
  return arg
}

export function forceExit (cmdName, timeout) {
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
export function createLock (...args) {
  return lock(...args)
}
