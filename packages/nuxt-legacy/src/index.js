import '@babel/polyfill'

import consola from 'consola'

import core from '../../../lib/core'
import builder from '../../../lib/builder'
import * as Utils from '../../../lib/common/utils'

consola.warn('You are using legacy build of Nuxt. Please consider upgrading your Node.js version to 8.x or later.')

export default Object.assign({ Utils }, core, builder)
