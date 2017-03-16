'use strict'

export function encodeHtml (str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function getContext (req, res) {
  return { req, res }
}

export function setAnsiColors (ansiHTML) {
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

export function * waitFor (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, (ms || 0))
  })
}

export function urlJoin () {
  return [].slice.call(arguments).join('/').replace(/\/+/g, '/').replace(':/', '://')
}

export function isUrl (url) {
  return (url.indexOf('http') === 0 || url.indexOf('//') === 0)
}

export function promisifyRouteParams (fn) {
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
