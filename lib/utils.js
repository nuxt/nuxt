'use strict'

exports.encodeHtml = (str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')

exports.getContext = function (req, res) {
  return {
    req: req,
    res: res
  }
}

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
