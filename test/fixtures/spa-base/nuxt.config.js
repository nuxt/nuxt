import { resolve } from 'path'
import defaultsDeep from 'lodash/defaultsDeep'
import baseNuxtConfig from '../spa/nuxt.config'

const config = {
  buildDir: resolve(__dirname, '.nuxt'),
  srcDir: resolve(__dirname, '..', 'spa'),
  router: {
    base: '/app'
  }
}

export default defaultsDeep(config, baseNuxtConfig)
