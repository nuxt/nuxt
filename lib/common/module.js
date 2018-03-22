const esm = require('esm')

const _esm = esm(module, {})

exports.requireModule = function requireModule() {
  const m = _esm.apply(this, arguments)
  return (m && m.default) || m
}
