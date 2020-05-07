
import _app from './_app'
import _common from './_common'

import build from './build'
import messages from './messages'
import modes from './modes'
import render from './render'
import router from './router'
import server from './server'
import cli from './cli'
import generate from './generate'

export const defaultNuxtConfigFile = 'nuxt.config'

export function getDefaultNuxtConfig (options = {}) {
  if (!options.env) {
    options.env = process.env
  }

  return {
    ..._app(),
    ..._common(),
    build: build(),
    messages: messages(),
    modes: modes(),
    render: render(),
    router: router(),
    server: server(options),
    cli: cli(),
    generate: generate()
  }
}
