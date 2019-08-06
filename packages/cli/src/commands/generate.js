import { common, locking } from '../options'
import { normalizeArg, createLock } from '../utils'

export default {
  name: 'generate',
  description: 'Generate a static web application (server-rendered)',
  usage: 'generate <dir>',
  options: {
    ...common,
    ...locking,
    build: {
      type: 'boolean',
      default: true,
      description: 'Only generate pages for dynamic routes. Nuxt has to be built once before using this option'
    },
    devtools: {
      type: 'boolean',
      default: false,
      description: 'Enable Vue devtools',
      prepare (cmd, options, argv) {
        options.vue = options.vue || {}
        options.vue.config = options.vue.config || {}
        if (argv.devtools) {
          options.vue.config.devtools = true
        }
      }
    },
    quiet: {
      alias: 'q',
      type: 'boolean',
      description: 'Disable output except for errors',
      prepare (cmd, options, argv) {
        // Silence output when using --quiet
        options.build = options.build || {}
        if (argv.quiet) {
          options.build.quiet = true
        }
      }
    },
    modern: {
      ...common.modern,
      description: 'Generate app in modern build (modern mode can be only client)',
      prepare (cmd, options, argv) {
        if (normalizeArg(argv.modern)) {
          options.modern = 'client'
        }
      }
    },
    'fail-on-error': {
      type: 'boolean',
      default: false,
      description: 'Exit with non-zero status code if there are errors when generating pages'
    }
  },
  async run (cmd) {
    const config = await cmd.getNuxtConfig({ dev: false, _generate: true, _build: cmd.argv.build })

    // Disable analyze if set by the nuxt config
    if (!config.build) {
      config.build = {}
    }
    config.build.analyze = false

    const nuxt = await cmd.getNuxt(config)

    if (cmd.argv.lock) {
      await cmd.setLock(await createLock({
        id: 'build',
        dir: nuxt.options.buildDir,
        root: config.rootDir
      }))

      nuxt.hook('build:done', async () => {
        await cmd.releaseLock()

        await cmd.setLock(await createLock({
          id: 'generate',
          dir: nuxt.options.generate.dir,
          root: config.rootDir
        }))
      })
    }

    const generator = await cmd.getGenerator(nuxt)

    const { errors } = await generator.generate({
      init: true,
      build: cmd.argv.build
    })

    if (cmd.argv['fail-on-error'] && errors.length > 0) {
      throw new Error('Error generating pages, exiting with non-zero code')
    }
  }
}
