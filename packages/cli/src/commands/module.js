import consola from 'consola'
import NuxtCommand from '../command'

const moduleError = (name, err) => {
  consola.error('Could not load any matching module.')
  throw err
}

const loadModule = async (name) => {
  let module
  try {
    module = await import(`@nuxt/${name}`)
  } catch (firstPass) {
    try {
      module = await import(`@nuxtjs/${name}`)
    } catch (secondPass) {
      try {
        module = await import(name)  
      } catch (thirdPass) {
        moduleError(name, thirdPass)
      }
    }
  }
}

export default async function module(name) {
  const module = await loadModule(name)
  // const nuxtCmd = new NuxtCommand({
  //   description: 'Generate a static web application (server-rendered)',
  //   usage: 'generate <dir>',
  //   options: [ 'build' ]
  // })

  // const argv = nuxtCmd.getArgv()

  // const generator = await nuxtCmd.getGenerator(
  //   await nuxtCmd.getNuxt(
  //     await nuxtCmd.getNuxtConfig(argv, { dev: false })
  //   )
  // )

  // return generator.generate({
  //   init: true,
  //   build: argv.build
  // }).then(() => {
  //   process.exit(0)
  // }).catch(err => consola.fatal(err))
}
