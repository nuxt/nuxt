import consola from 'consola'
import chalk from 'chalk'
import env from 'std-env'
import { common, server } from '../options'
import { showBanner } from '../utils'

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
      } catch (err) {
        return errorHandler(err, oldInstance)
      }

      const logChanged = (name) => {
        consola.log({
          type: 'change',
          icon: chalk.blue.bold(env.windows ? '»' : '↻'),
          message: chalk.blue(name)
        })
      }

      nuxt.hook('watch:fileChanged', async (builder, name) => {
        logChanged(name)
        await startDev({ nuxt: builder.nuxt, builder })
      })

      nuxt.hook('bundler:change', (name) => {
        logChanged(name)
      })

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
          // Show banner
          .then(() => showBanner(nuxt))
          // Start watching serverMiddleware changes
          .then(() => builder.watchServer())
          // Handle errors
          .catch(err => errorHandler(err, { builder, nuxt }))
      )
    }

    await startDev()
  }
}
