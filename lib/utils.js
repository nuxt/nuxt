'use strict'
import { resolve, sep } from 'path'
import _ from 'lodash'

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

export async function waitFor (ms) {
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

export function promisifyRoute (fn) {
  // If routes is an array
  if (Array.isArray(fn)) {
    return Promise.resolve(fn)
  }
  // If routes is a function expecting a callback
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
  if (!promise || (!(promise instanceof Promise) && (typeof promise.then !== 'function'))) {
    promise = Promise.resolve(promise)
  }
  return promise
}

export function sequence (tasks, fn) {
  return tasks.reduce((promise, task) => promise.then(() => fn(task)), Promise.resolve())
}

export function chainFn (base, fn) {
  /* istanbul ignore if */
  if (!(fn instanceof Function)) {
    return
  }
  return function () {
    if (base instanceof Function) {
      base.apply(this, arguments)
    }
    fn.apply(this, arguments)
  }
}

function wp (p) {
  /* istanbul ignore if */
  if (/^win/.test(process.platform)) {
    p = p.replace(/\\/g, '\\\\')
  }
  return p
}

const reqSep = /\//g
const sysSep = _.escapeRegExp(sep)
const normalize = string => string.replace(reqSep, sysSep)

export function r () {
  let args = Array.from(arguments)
  if (_.last(args).includes('~')) {
    return wp(_.last(args))
  }
  args = args.map(normalize)
  return wp(resolve.apply(null, args))
}
