import 'babel-polyfill'

import core from './core'
import builder from './builder'
import * as Utils from './common/utils'

export default Object.assign({ Utils }, core, builder)
