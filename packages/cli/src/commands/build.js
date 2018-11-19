import consola from 'consola'
import { common } from '../options'

export default {
  name: 'build',
  description: 'Compiles the application for production deployment',
  usage: 'build <dir>',
  options: {
    ...common,
    analyze: {
      alias: 'a',
      type: 'boolean',
      description: 'Launch webpack-bundle-analyzer to optimize your bundles',
      prepare(cmd, options, argv) {
        // Analyze option
        options.build = options.build || {}
        if (argv.analyze && typeof options.build.analyze !== 'object') {
          options.build.analyze = true
        }
      }
    },
    devtools: {
      type: 'boolean',
      default: false,
      description: 'Enable Vue devtools',
      prepare(cmd, options, argv) {
        options.vue = options.vue || {}
        options.vue.config = options.vue.config || {}
        if (argv.devtools) {
          options.vue.config.devtools = true
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
      prepare(cmd, options, argv) {
        // Silence output when using --quiet
        options.build = options.build || {}
        if (argv.quiet) {
          options.build.quiet = !!argv.quiet
        }
      }
    }
  },
  async run(cmd) {
    const argv = cmd.getArgv()

    // Create production build when calling `nuxt build` (dev: false)
    const nuxt = await cmd.getNuxt(
      await cmd.getNuxtConfig(argv, { dev: false })
    )

    let builderOrGenerator
    if (nuxt.options.mode !== 'spa' || argv.generate === false) {
      // Build only
      builderOrGenerator = (await cmd.getBuilder(nuxt)).build()
    } else {
      // Build + Generate for static deployment
      builderOrGenerator = (await cmd.getGenerator(nuxt)).generate({
        build: true
      })
    }

    return builderOrGenerator
      .then(() => {
        // In analyze mode wait for plugin
        // emitting assets and opening browser
        if (
          nuxt.options.build.analyze === true ||
          typeof nuxt.options.build.analyze === 'object'
        ) {
          return
        }

        process.exit(0)
      })
      .catch(err => consola.fatal(err))
  }
}
