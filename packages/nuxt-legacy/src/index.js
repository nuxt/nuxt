import '@babel/polyfill'

import consola from 'consola'

import core from '../../nuxt-core/src/core'
import builder from '../../nuxt-core/src/builder'
import * as Utils from '../../nuxt-core/src/common/utils'

consola.warn('You are using legacy build of Nuxt. Please consider upgrading your Node.js version to 8.x or later.')

export default Object.assign({ Utils }, core, builder)
