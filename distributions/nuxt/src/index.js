
import * as deps from './deps'

global.__NUXT_DEPS__ = deps

export * from '@nuxt/core'
export * from '@nuxt/server'
export * from '@nuxt/builder'
export * from '@nuxt/generator'
export { run, getWebpackConfig } from '@nuxt/cli'
