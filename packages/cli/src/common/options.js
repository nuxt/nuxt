import consola from 'consola'

export default {
  port: {
    alias: 'p',
    type: 'string',
    description: 'Port number on which to start the application',
    handle(options, argv) {
      if (argv.port) {
        options.server.port = +argv.port
      }
    }
  },
  hostname: {
    alias: 'H',
    type: 'string',
    description: 'Hostname on which to start the application',
    handle(options, argv) {
      if (argv.hostname === '') {
        consola.fatal('Provided hostname argument has no value')
      }
    }
  },
  'unix-socket': {
    alias: 'n',
    type: 'string',
    description: 'Path to a UNIX socket'
  },
  analyze: {
    alias: 'a',
    type: 'boolean',
    description: 'Launch webpack-bundle-analyzer to optimize your bundles',
    handle(options, argv) {
      // Analyze option
      options.build = options.build || {}
      if (argv.analyze && typeof options.build.analyze !== 'object') {
        options.build.analyze = true
      }
    }
  },
  build: {
    type: 'boolean',
    default: true,
    description: 'Only generate pages for dynamic routes. Nuxt has to be built once before using this option'
  },
  generate: {
    type: 'boolean',
    default: true,
    description: 'Don\'t generate static version for SPA mode (useful for nuxt start)'
  },
  spa: {
    alias: 's',
    type: 'boolean',
    description: 'Launch in SPA mode'
  },
  universal: {
    alias: 'u',
    type: 'boolean',
    description: 'Launch in Universal mode (default)'
  },
  'config-file': {
    alias: 'c',
    type: 'string',
    default: 'nuxt.config.js',
    description: 'Path to Nuxt.js config file (default: nuxt.config.js)'
  },
  quiet: {
    alias: 'q',
    type: 'boolean',
    description: 'Disable output except for errors',
    handle(options, argv) {
      // Silence output when using --quiet
      options.build = options.build || {}
      if (argv.quiet) {
        options.build.quiet = !!argv.quiet
      }
    }
  },
  verbose: {
    alias: 'v',
    type: 'boolean',
    description: 'Show debug information'
  },
  version: {
    type: 'boolean',
    description: 'Display the Nuxt version'
  },
  help: {
    alias: 'h',
    type: 'boolean',
    description: 'Display this message'
  }
}
