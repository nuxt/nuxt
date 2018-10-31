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
    generate: {
      type: 'boolean',
      default: true,
      description: 'Don\'t generate static version for SPA mode (useful for nuxt start)'
    },
    modern: {
      alias: 'm',
      type: 'boolean',
      description: 'Build app for modern browsers',
      prepare(cmd, options, argv) {
        options.build = options.build || {}
        if (argv.modern) {
          options.build.modern = !!argv.modern
        }
      }
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
  async run() {
    const argv = this.getArgv()

    // Create production build when calling `nuxt build` (dev: false)
    const config = await this.getNuxtConfig(argv, { dev: false })

    if (argv.lock) {
      await this.lock(config.srcDir || config.rootDir)
    }

    const nuxt = await this.getNuxt(config)

    // In analyze mode wait for plugin
    // emitting assets and opening browser
    if (nuxt.options.build.analyze === true ||
          typeof nuxt.options.build.analyze === 'object') {
      this.disableForceExit()
    }

    // Setup hooks
    nuxt.hook('error', err => consola.fatal(err))

    let builderOrGenerator
    if (nuxt.options.mode !== 'spa' || argv.generate === false) {
      // Build only
      builderOrGenerator = (await this.getBuilder(nuxt)).build()
    } else {
      // Build + Generate for static deployment
      builderOrGenerator = (await this.getGenerator(nuxt)).generate({
        build: true
      })
    }

    return builderOrGenerator
  }
}
