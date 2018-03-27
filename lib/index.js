const requireModule = require('esm')(module, {})

module.exports = requireModule('./nuxt').default
