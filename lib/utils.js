'use strict'

exports.encodeHtml = (str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')

exports.getContext = (req, res) => ({ req, res })

exports.setAnsiColors = function (ansiHTML) {
  ansiHTML.setColors({
    reset: ['efefef', 'a6004c'],
    darkgrey: '5a012b',
    yellow: 'ffab07',
    green: 'aeefba',
    magenta: 'ff84bf',
    blue: '3505a0',
    cyan: '56eaec',
    red: '4e053a'
  })
}

exports.waitFor = function * (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, (ms || 0))
  })
}

exports.urlJoin = function () {
  return [].slice.call(arguments).join('/').replace(/\/+/g, '/')
}

exports.promisifyRouteParams = function (fn) {
  // If routeParams[route] is an array
  if (Array.isArray(fn)) {
    return Promise.resolve(fn)
  }
  // If routeParams[route] is a function expecting a callback
  if (fn.length === 1) {
    return new Promise((resolve, reject) => {
      fn(function (err, routeParams) {
        if (err) {
          reject(err)
        }
        resolve(routeParams)
      })
    })
  }
  let promise = fn()
  if (!(promise instanceof Promise)) {
    promise = Promise.resolve(promise)
  }
  return promise
}
