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
  }
}