import consola from 'consola'
import NuxtCommand from '../common/command'

export default async function dev() {
  const nuxtCmd = new NuxtCommand({
    description: 'Start the application in development mode (e.g. hot-code reloading, error reporting)',
    usage: 'dev <dir> -p <port number> -H <hostname>',
    options: [ 'hostname', 'port' ]
  })

  const argv = nuxtCmd.getArgv()

  const errorHandler = (err, instance) => {
    instance && instance.builder.watchServer()
    consola.error(err)
  }

  const { Nuxt } = await nuxtCmd.importCore()
  const { Builder } = await nuxtCmd.importBuilder()

  // Start dev
  async function startDev(oldInstance) {
    let nuxt, builder

    try {
      nuxt = new Nuxt(await nuxtCmd.getNuxtConfig(argv, { dev: true }))
      builder = new Builder(nuxt)
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
        .then(() => nuxt.listen())
        // Show ready message first time, others will be shown through WebpackBar
        .then(() => !oldInstance && nuxt.showReady(false))
        .then(() => builder.watchServer())
        // Handle errors
        .catch(err => errorHandler(err, { builder, nuxt }))
    )
  }

  await startDev()
}
