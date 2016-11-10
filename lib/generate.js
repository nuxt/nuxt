'use strict'

const fs = require('fs-extra')
const co = require('co')
const pify = require('pify')
const debug = require('debug')('nuxt:generate')
const _ = require('lodash')
const { resolve, join, dirname } = require('path')
const copy = pify(fs.copy)
const remove = pify(fs.remove)
const writeFile = pify(fs.writeFile)
const mkdirp = pify(fs.mkdirp)

const defaults = {
  dir: 'dist',
  routeParams: {}
}

module.exports = function () {
  /*
  ** Set variables
  */
  this.options.generate = _.defaultsDeep(this.options.generate, defaults)
  var srcStaticPath = resolve(this.dir, 'static')
  var srcBuiltPath = resolve(this.dir, '.nuxt', 'dist')
  var distPath = resolve(this.dir, this.options.generate.dir)
  var distNuxtPath = resolve(distPath, '_nuxt')
  return co(function * () {
    /*
    ** Clean destination folder
    */
    try {
      yield remove(distPath)
      debug('Destination folder cleaned')
    } catch (e) {}
    /*
    ** Copy static and built files
    */
    yield [
      copy(srcStaticPath, distPath),
      copy(srcBuiltPath, distNuxtPath)
    ]
    debug('Static & build files copied')
  })
  .then(() => {
    /*
    ** Generate html files from routes
    */
    var promises = []
    this.routes.forEach((route) => {
      var promise = this.renderRoute(route.path)
      .then(({ html }) => {
        var path = join(route.path, '/', 'index.html') // /about -> /about/index.html
        debug('Generate file: ' + path)
        path = join(distPath, path)
        // Make sure the sub folders are created
        return co(function * () {
          yield mkdirp(dirname(path))
          yield writeFile(path, html, 'utf8')
        })
      })
      promises.push(promise)
    })
    return Promise.all(promises)
  })
  .then((pages) => {
    debug('HTML Files generated')
  })
}
