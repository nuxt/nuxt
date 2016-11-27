'use strict'

const debug = require('debug')('nuxt:generate')
const fs = require('fs-extra')
const co = require('co')
const pify = require('pify')
const pathToRegexp = require('path-to-regexp')
const _ = require('lodash')
const { resolve, join, dirname, sep } = require('path')
const { urlJoin, promisifyRouteParams } = require('./utils')
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
    // Resolve config.generate.routesParams promises before generating the routes
    return resolveRouteParams(this.options.generate.routeParams)
  })
  .then(() => {
    /*
    ** Generate html files from routes
    */
    var promises = []
    this.routes.forEach((route) => {
      let subRoutes = []
      if (route.path.includes(':') || route.path.includes('*')) {
        const routeParams = this.options.generate.routeParams[route.path]
        if (!routeParams) {
          console.error(`Could not generate the dynamic route ${route.path}, please add the mapping params in nuxt.config.js (generate.routeParams).`)
          return process.exit(1)
        }
        const toPath = pathToRegexp.compile(route.path)
        routeParams.forEach((params) => {
          const newRoute = Object.assign({}, route, { path: toPath(params) })
          subRoutes.push(newRoute)
        })
      } else {
        subRoutes.push(route)
      }
      subRoutes.forEach((route) => {
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
    })
    return Promise.all(promises)
  })
  .then((pages) => {
    // Add .nojekyll file to let Github Pages add the _nuxt/ folder
    // https://help.github.com/articles/files-that-start-with-an-underscore-are-missing/
    const nojekyllPath = resolve(distPath, '.nojekyll')
    return writeFile(nojekyllPath)
  })
  .then(() => {
    debug('HTML Files generated')
  })
}

function resolveRouteParams (routeParams) {
  let promises = []
  Object.keys(routeParams).forEach(function (routePath) {
    let promise = promisifyRouteParams(routeParams[routePath])
    .then((routeParamsData) => {
      routeParams[routePath] = routeParamsData
    })
    .catch((e) => {
      console.error(`Could not resolve routeParams[${routePath}]`)
      console.error(e)
      process.exit(1)
    })
    promises.push(promise)
  })
  return Promise.all(promises)
}
