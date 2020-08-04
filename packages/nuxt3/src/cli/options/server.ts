import consola from 'consola'
import type { ParsedArgs } from 'minimist'

import { Configuration } from 'src/config/options'

import NuxtCommand from '../command'

export default {
  port: {
    alias: 'p',
    type: 'string',
    description: 'Port number on which to start the application',
    prepare (_cmd: NuxtCommand, options: Configuration, argv: ParsedArgs) {
      if (argv.port) {
        options.server.port = +argv.port
      }
    }
  },
  hostname: {
    alias: 'H',
    type: 'string',
    description: 'Hostname on which to start the application',
    prepare (_cmd: NuxtCommand, _options: any, argv: ParsedArgs) {
      if (argv.hostname === '') {
        consola.fatal('Provided hostname argument has no value')
      }
    }
  },
  'unix-socket': {
    alias: 'n',
    type: 'string',
    description: 'Path to a UNIX socket'
  }
}
