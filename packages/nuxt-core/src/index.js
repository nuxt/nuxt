import core from './core'
import builder from './builder'
import * as Utils from './common/utils'
import Options from './common/options'

export default Object.assign({ Utils, Options }, core, builder)
