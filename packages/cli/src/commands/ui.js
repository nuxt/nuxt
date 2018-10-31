import consola from 'consola'
import { common, server } from '../options'

export default {
  name: 'ui',
  description: 'Start the application in development mode with Nuxt UI',
  usage: 'ui <dir>',
  options: {
    ...common,
    ...server
  },
  async run(cmd) {
    const argv = cmd.getArgv()

    consola.info('Nuxt UI running, logs will be displayed in the browser.')

    const errorHandler = (err, instance) => {
      instance && instance.builder.watchServer()
      consola.error(err)
    }

    // Start dev
    async function startDev(oldInstance) {
      let nuxt, builder

      try {
        nuxt = await cmd.getNuxt(
          await cmd.getNuxtConfig(argv, { dev: true, ui: true })
        )
        builder = await cmd.getBuilder(nuxt)
        nuxt.hook('watch:fileChanged', async (builder, fname) => {
          consola.debug(`[${fname}] changed, Rebuilding the app...`)
          await startDev({ nuxt: builder.nuxt, builder })
        })
      } catch (err) {
        return errorHandler(err, oldInstance)
      }

      return (
        Promise.resolve()
          .then(() => oldInstance && oldInstance.nuxt.clearHook('watch:fileChanged'))
          .then(() => oldInstance && oldInstance.builder.unwatch())
          .then(() => oldInstance && oldInstance.nuxt.close())
          // Start listening
          .then(() => nuxt.listen())
          // Show ready message first time, others will be shown through WebpackBar
          .then(() => !oldInstance && nuxt.showReady(false))
          .then(() => !oldInstance && consola.clear())
          // Start build
          .then(() => builder.build())
          .then(() => builder.watchServer())
          // Handle errors
          .catch((err) => {
            oldInstance && oldInstance.nuxt.close()
            errorHandler(err, { builder, nuxt })
          })
      )
    }

    await startDev()
  }
}
