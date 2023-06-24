module.exports = function (...args) {
  return import('./dist/index.mjs').then(m => m.default.call(this, ...args))
}
