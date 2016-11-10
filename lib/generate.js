'use strict'

// const fs = require('fs')
const { ncp } = require('ncp')
// const debug = require('debug')('nuxt:generate')
const _ = require('lodash')
const { resolve } = require('path')

const defaults = {
  dir: 'dist',
  routeParams: {}
}

module.exports = function * () {
  /*
  ** Set variables
  */
  this.options.generate = _.defaultsDeep(this.options.generate, defaults)
  var srcStaticPath = resolve(this.dir, 'static')
  var srcBuiltPath = resolve(this.dir, '.nuxt', 'dist')
  var distPath = resolve(this.dir, this.options.generate.dir)
  var distNuxtPath = resolve(distPath, '_nuxt')
  /*
  ** Copy static and built files
  */
  ncp(srcStaticPath, distNuxtPath, function (err) {
    if (err) {
      return console.log(err)
    }
    console.log('[nuxt] Static files copied')
  })
  ncp(srcBuiltPath, distNuxtPath, function (err) {
    if (err) {
      return console.log(err)
    }
    console.log('[nuxt] Built files copied')
  })
  /*
  ** Generate html files from routes
  */
  var promises = []
  this.options.routes.forEach((route) => {
    var promise = this.renderRoute(route.path).then((html) => {
      return {
        path: route.path,
        html
      }
    })
    promises.push(promise)
  })
  // Promise.all(promises).then((page) => {
  // verifier erreur
  // })
}
