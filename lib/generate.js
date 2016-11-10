'use strict'

const fs = require('fs-extra')
const co = require('co')
const pify = require('pify')
const debug = require('debug')('nuxt:generate')
const _ = require('lodash')
const { resolve, join, dirname, sep } = require('path')
const { urlJoin } = require('./utils')
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
  ** Update loaders config to add router.base path
  */
  this.options.build.loaders.forEach((config) => {
    if (['file', 'url', 'file-loader', 'url-loader'].includes(config.loader)) {
      config.query = config.query || {}
      config.query.publicPath = urlJoin(this.options.router.base, '/_nuxt/')
    }
  })
  /*
  ** Set variables
  */
  this.options.generate = _.defaultsDeep(this.options.generate, defaults)
  var self = this
  var srcStaticPath = resolve(this.dir, 'static')
  var srcBuiltPath = resolve(this.dir, '.nuxt', 'dist')
  var distPath = resolve(this.dir, this.options.generate.dir)
  var distNuxtPath = resolve(distPath, '_nuxt')
  return co(function * () {
    /*
    ** Launch build process
    */
    self.options._build = true
    self.options._renderer = true
    yield self.build()
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
    if (fs.existsSync(srcStaticPath)) {
      yield copy(srcStaticPath, distPath)
    }
    yield copy(srcBuiltPath, distNuxtPath)
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
        var path = join(route.path, sep, 'index.html') // /about -> /about/index.html
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
