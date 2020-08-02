
import _app from './_app'
import _common from './_common'

import build from './build'
import messages from './messages'
import modes from './modes'
import render from './render'
import router from './router'
import server from './server'
import cli from './cli'
import generate, { GenerateOptions } from './generate'

export const defaultNuxtConfigFile = 'nuxt.config'

export const getDefaultNuxtConfig = () =>
  ({
    ..._app(),
    ..._common(),
    build: build(),
    messages: messages(),
    modes: modes(),
    render: render(),
    router: router(),
    server: server({ env: process.env }) as ReturnType<typeof server> | boolean,
    cli: cli(),
    generate: generate(),
    export: undefined as undefined | GenerateOptions,
    telemetry: undefined as undefined | boolean,
  })

export type DefaultConfiguration = ReturnType<typeof getDefaultNuxtConfig>