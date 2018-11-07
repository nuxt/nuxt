export default {
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
  modern: {
    alias: 'm',
    type: 'boolean',
    description: 'Build/Start app for modern browsers',
    prepare(cmd, options, argv) {
      if (argv.modern) {
        options.modern = argv.modern
      }
    }
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
