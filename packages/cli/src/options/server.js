import consola from 'consola'

export default {
  port: {
    alias: 'p',
    type: 'string',
    description: 'Port number on which to start the application',
    prepare (cmd, options, argv) {
      if (argv.port) {
        options.server.port = +argv.port
      }
    }
  },
  hostname: {
    alias: 'H',
    type: 'string',
    description: 'Hostname on which to start the application',
    prepare (cmd, options, argv) {
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
