import consola from 'consola'
import { common, server } from '../options'

export default {
  name: 'dev',
  description: 'Start the application in development mode (e.g. hot-code reloading, error reporting)',
  usage: 'dev <dir>',
  options: {
    ...common,
    ...server
  },
  async run() {
    this.disableForceExit()

    const argv = this.getArgv()

    const getConfig = () => {
      return this.getNuxtConfig(argv, { dev: true })
    }

    const errorHandler = (err, instance) => {
      instance && instance.builder.watchServer()
      consola.error(err)
    }

    const config = await getConfig()

    if (argv.lock) {
      await this.lock(config.srcDir || config.rootDir, { autoUnlock: false })
    }

    // Start dev
    const startDev = async (config, oldInstance) => {
      let nuxt, builder

      try {
        nuxt = await this.getNuxt(config)
        builder = await this.getBuilder(nuxt)
        nuxt.hook('watch:fileChanged', async (builder, fname) => {
          consola.debug(`[${fname}] changed, Rebuilding the app...`)
          await startDev(await getConfig(), { nuxt: builder.nuxt, builder })
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

    await startDev(config)
  }
}
