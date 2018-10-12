import Core from '@nuxtjs/core'
import Builder from '@nuxtjs/builder'
import * as Utils from '@nuxtjs/common/src/utils'
import Options from '@nuxtjs/common/src/options'

export default Object.assign({ Utils, Options }, Core, Builder)
