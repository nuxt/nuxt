import { resolve } from 'path'

export * as builder from '@nuxt/builder'
export * as webpack from '@nuxt/webpack'
export * as generator from '@nuxt/generator'
export * as core from '@nuxt/core'
export * as server from '@nuxt/server'
export * as vueApp from '@nuxt/vue-app'

export const babelPresetApp = resolve(__dirname, '../dist/babel-preset-app/src/index.js')
