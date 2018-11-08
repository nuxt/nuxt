
import _app from './_app'
import _common from './_common'

import build from './build'
import messages from './messages'
import modes from './modes'
import render from './render'
import router from './router'
import server from './server'
import cli from './cli'

export function getDefaultNuxtConfig(options = {}) {
  if (!options.env) {
    options.env = process.env
  }

  return {
    ..._app(options),
    ..._common(options),
    build: build(options),
    messages: messages(options),
    modes: modes(options),
    render: render(options),
    router: router(options),
    server: server(options),
    cli: cli(options)
  }
}
