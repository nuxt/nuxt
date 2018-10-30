
import _app from './_app'
import _common from './_common'

import build from './build'
import messages from './messages'
import modes from './modes'
import render from './render'
import router from './router'
import server from './server'

export function getNuxtConfig() {
  return {
    ..._app(),
    ..._common(),
    build: build(),
    messages: messages(),
    modes: modes(),
    render: render(),
    router: router(),
    server: server()
  }
}
