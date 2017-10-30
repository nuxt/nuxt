const resolve = require('path').resolve
const { Nuxt, Builder } = require('nuxt')

// Setup nuxt.js
let config = {}
try {
  config = require('../../nuxt.config.js')
} catch (e) {}
config.rootDir = resolve(__dirname, '..', '..')
config.dev = process.env.NODE_ENV !== 'production'

const nuxt = new Nuxt(config)
if (config.dev) {
  const builder = new Builder(nuxt)
  builder.build().then(() => process.emit('nuxt:build:done'))
} else {
  process.nextTick(() => process.emit('nuxt:build:done'))
}

// Add nuxt.js middleware
module.exports = function (req, res) {
  nuxt.render(req, res)
}
