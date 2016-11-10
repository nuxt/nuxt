'use strict'

const fs = require('fs-extra')
const co = require('co')
const pify = require('pify')
const debug = require('debug')('nuxt:generate')
const _ = require('lodash')
const { resolve, join } = require('path')
const copy = pify(fs.copy)
const remove = pify(fs.remove)
const writeFile = pify(fs.writeFile)

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
  co(function * () {
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
    this.options.routes.forEach((route) => {
      var promise = this.renderRoute(route.path)
      .then(({ html }) => {
        var path = route.path
        path += path[path.length - 1] === '/' ? 'index.html' : '.html'
        debug('Generate file : ' + path)
        path = join(distPath, path)
        return writeFile(path, html, 'utf8')
      })
      console.log(promise)
      promises.push(promise)
    })
    return Promise.all(promises)
  })
  .then((pages) => {
    debug('HTML Files generated')
  })
}
