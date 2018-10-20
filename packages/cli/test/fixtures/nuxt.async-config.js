import { resolve } from 'path'

export default () => {
  delete require.cache[resolve(__dirname, 'nuxt.config.js')]
  return import('./nuxt.config.js')
}
