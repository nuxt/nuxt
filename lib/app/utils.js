'use strict'

export function getMatchedComponents (route) {
  return [].concat.apply([], route.matched.map(function (m) {
    return Object.keys(m.components).map(function (key) {
      return m.components[key]
    })
  }))
}

export function flatMapComponents (route, fn) {
  return Array.prototype.concat.apply([], route.matched.map(function (m, index) {
    return Object.keys(m.components).map(function (key) {
      return fn(m.components[key], m.instances[key], m, key, index)
    })
  }))
}

export function getContext (context) {
  let ctx = {
    isServer: !!context.isServer,
    isClient: !!context.isClient,
    <%= (store ? 'store: context.store,' : '') %>
    route: (context.to ? context.to : context.route)
  }
  if (context.req) ctx.req = context.req
  if (context.res) ctx.req = context.res
  return ctx
}

// Imported from vue-router
export function getLocation (base) {
  var path = window.location.pathname
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length)
  }
  return (path || '/') + window.location.search + window.location.hash
}
