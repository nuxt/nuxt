function getProxy (name) {
  const fn = function () { }
  fn.prototype.name = name

  const props = {}

  return new Proxy(fn, {
    get (_target, prop) {
      if (prop === 'caller') { return null }
      return (props[prop] = props[prop] || getProxy(`${name}.${prop.toString()}`))
    },
    apply (_target, _this, _args) {
      console.debug(`${name}(...)`)
      return getProxy(`${name}()`)
    },
    construct (_target, _args, _newT) {
      return getProxy(`[${name}]`)
    },
    enumerate (_target) {
      return []
    }
  })
}

module.exports = getProxy('mock')
