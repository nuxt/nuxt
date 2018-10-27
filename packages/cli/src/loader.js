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

export default async function loader(moduleName) {
  const module = await loadModule(moduleName)
  const nuxtCmd = new NuxtCommand({ module: module.cli })
  nuxtCmd.run.then(() => {
    process.exit(0)
  }).catch(err => consola.fatal(err))
}
