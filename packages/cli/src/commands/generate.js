import { TARGETS } from '@nuxt/utils'
import consola from 'consola'
import { common, locking } from '../options'
import { normalizeArg, createLock } from '../utils'
import { ensureBuild, generate } from '../utils/generate'

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
      description: 'Only generate pages for dynamic routes, used for incremental builds. Generate has to be run once without this option before using it'
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
    'force-build': {
      type: 'boolean',
      default: false,
      description: 'Force to build the application with webpack'
    },
    'fail-on-error': {
      type: 'boolean',
      default: false,
      description: 'Exit with non-zero status code if there are errors when generating pages'
    }
  },
  async run (cmd) {
    const config = await cmd.getNuxtConfig({ dev: false })

    // Disable analyze if set by the nuxt config
    config.build = config.build || {}
    config.build.analyze = false

    // Full static
    if (config.target === TARGETS.static) {
      await ensureBuild(cmd)
      await generate(cmd)
      return
    }

    // Forcing static target anyway
    config.target = TARGETS.static
    consola.warn(`When using \`nuxt generate\`, you should set \`target: 'static'\` in your \`nuxt.config\`\n       👉 Learn more about it on https://go.nuxtjs.dev/static-target`)

    // Set flag to keep the prerendering behaviour
    config._legacyGenerate = true

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
    await nuxt.server.listen(0)

    const { errors } = await generator.generate({
      init: true,
      build: cmd.argv.build
    })

    await nuxt.close()
    if (cmd.argv['fail-on-error'] && errors.length > 0) {
      throw new Error('Error generating pages, exiting with non-zero code')
    }
  }
}
