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
      prepare(cmd, options, argv) {
        options.vue = options.vue || {}
        options.vue.config = options.vue.config || {}
        if (argv.devtools) {
          options.vue.config.devtools = true
        }
      }
    },
    modern: {
      ...common.modern,
      description: 'Generate app in modern build (modern mode can be only client)',
      prepare(cmd, options, argv) {
        if (normalizeArg(argv.modern)) {
          options.modern = 'client'
        }
      }
    }
  },
  async run(cmd) {
    const config = await cmd.getNuxtConfig({ dev: false })

    // Disable analyze if set by the nuxt config
    if (!config.build) {
      config.build = {}
    }
    config.build.analyze = false

    const nuxt = await cmd.getNuxt(config)

    if (cmd.argv.lock) {
      cmd.setLock(await createLock({
        id: 'build',
        dir: nuxt.options.buildDir,
        root: config.rootDir
      }))

      nuxt.hook('build:done', async () => {
        await cmd.releaseLock()

        cmd.setLock(await createLock({
          id: 'generate',
          dir: nuxt.options.generate.dir,
          root: config.rootDir
        }))
      })
    }

    const generator = await cmd.getGenerator(nuxt)

    await generator.generate({
      init: true,
      build: cmd.argv.build
    })
  }
}
