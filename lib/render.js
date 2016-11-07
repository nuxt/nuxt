'use strict'

const debug = require('debug')('nuxt:render')
const { join } = require('path')
const { getRoute, waitFor } = require('./utils')

function * render (req, res, next) {
  if (!this.renderer) {
    yield waitFor(1000)
    yield this.render(req, res, next)
    return
  }
  debug(`Start rendering ${req.url}...`)
  const route = getRoute(req.url)
  const path = join('pages', (route === '/' ? 'index' : route)).replace('.vue', '')
  debug(`Find ${path}.vue`)
}

module.exports = render
