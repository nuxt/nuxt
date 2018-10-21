import { resolve } from 'path'

export default () => {
  // delete cache is needed because otherwise Jest will return the same
  // object reference as the previous test and then mode will not be
  // set correctly. jest.resetModules doesnt work for some reason
  delete require.cache[resolve(__dirname, 'nuxt.config.js')]
  return import('./nuxt.config.js')
}
