import { common, locking } from '../options'
import { createLock } from '../utils'

export default {
  name: 'build',
  description: 'Compiles the application for production deployment',
  usage: 'build <dir>',
  // options 여기 있네
  options: {
    ...common,
    ...locking,
    analyze: {
      alias:'a' ,
      type: 'boolean',
      description: 'Launch webpack-bundle-analyzer to optimize your bundles',
      prepare(cmd, options, argv) {
        // Analyze option
        // options.build를 넣거나, options.build 아니면 뒤의 빈 오브젝트를 넣겠다
        options.build = options.build || {}
        // argv.analyze와 options.build.analyze가 object가 아니면
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
          // !! 는 논리 연산에서 확실한 true/false리턴을 위해 사용함. undefined나 null의 경우 특히
          options.build.quiet = !!argv.quiet
        }
      }
    },
    standalone: {
      type: 'boolean',
      default: false,
      description: 'Bundle all server dependencies (useful for nuxt-start)',
      prepare(cmd, options, argv) {
        if (argv.standalone) {
          options.build.standalone = true
        }
      }
    }
  },
  async run(cmd) {
    // cmd는 NuxtCommand 클래스의 인스턴스임 (경로: ../command.js)
    const config = await cmd.getNuxtConfig({ dev: false, _build: true })
    const nuxt = await cmd.getNuxt(config)

    if (cmd.argv.lock) {
      await cmd.setLock(await createLock({
        id: 'build',
        dir: nuxt.options.buildDir,
        root: config.rootDir
      }))
    }

    if (nuxt.options.mode !== 'spa' || cmd.argv.generate === false) {
      // Build only
      const builder = await cmd.getBuilder(nuxt)
      await builder.build()
      return
    }

    // Build + Generate for static deployment
    const generator = await cmd.getGenerator(nuxt)
    await generator.generate({ build: true })
  }
}
