import Consola from 'consola'
import { common, server } from '../options'

const consola = Consola.withTag('nuxt:cli:dev')

export default {
  name: 'dev',
  description: 'Start the application in development mode (e.g. hot-code reloading, error reporting)',
  usage: 'dev <dir>',
  options: {
    ...common,
    ...server
  },
  async run(cmd) {
    const argv = cmd.getArgv()

    const errorHandler = (err, instance) => {
      instance && instance.builder.watchServer()
      consola.error(err)
    }

    // Start dev
    async function startDev(oldInstance) {
      let nuxt, builder

      try {
        nuxt = await cmd.getNuxt(
          await cmd.getNuxtConfig(argv, { dev: true })
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
          // Start build
          .then(() => builder.build())
          // Close old nuxt no matter if build successfully
          .catch((err) => {
            oldInstance && oldInstance.nuxt.close()
            // Jump to errorHandler
            throw err
          })
          .then(() => oldInstance && oldInstance.nuxt.close())
          // Start listening
          .then(() => nuxt.server.listen())
          // Show ready message first time, others will be shown through WebpackBar
          .then(() => !oldInstance && nuxt.server.showReady(false))
          .then(() => builder.watchServer())
          // Handle errors
          .catch(err => errorHandler(err, { builder, nuxt }))
      )
    }

    await startDev()
  }
}
