export default {
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
  generate: {
    type: 'boolean',
    default: true,
    description: 'Don\'t generate static version for SPA mode (useful for nuxt start)'
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
  }
}