'use strict'

import fs from 'fs-extra'
import co from 'co'
import pify from 'pify'
import _ from 'lodash'
import { resolve, join, dirname, sep } from 'path'
import { isUrl, promisifyRoute, waitFor } from './utils'
import { minify } from 'html-minifier'
const debug = require('debug')('nuxt:generate')
const copy = pify(fs.copy)
const remove = pify(fs.remove)
const writeFile = pify(fs.writeFile)
const mkdirp = pify(fs.mkdirp)

const defaults = {
  dir: 'dist',
  routes: [],
  interval: 0,
  minify: {
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    decodeEntities: true,
    minifyCSS: true,
    minifyJS: true,
    processConditionalComments: true,
    removeAttributeQuotes: false,
    removeComments: false,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: false,
    removeStyleLinkTypeAttributes: false,
    removeTagWhitespace: false,
    sortAttributes: true,
    sortClassName: true,
    trimCustomFragments: true,
    useShortDoctype: true
  }
}

export default function () {
  const s = Date.now()
  let errors = []
  /*
  ** Set variables
  */
  this.options.generate = _.defaultsDeep(this.options.generate, defaults)
  var self = this
  var srcStaticPath = resolve(this.srcDir, 'static')
  var srcBuiltPath = resolve(this.dir, '.nuxt', 'dist')
  var distPath = resolve(this.dir, this.options.generate.dir)
  var distNuxtPath = join(distPath, (isUrl(this.options.build.publicPath) ? '' : this.options.build.publicPath))
  return co(function * () {
    /*
    ** Launch build process
    */
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
    // Resolve config.generate.routes promises before generating the routes
    return promisifyRoute(this.options.generate.routes || [])
    .catch((e) => {
      console.error('Could not resolve routes') // eslint-disable-line no-console
      console.error(e) // eslint-disable-line no-console
      process.exit(1)
      throw e // eslint-disable-line no-unreachable
    })
  })
  .then((generateRoutes) => {
    /*
    ** Generate html files from routes
    */
    generateRoutes.forEach((route) => {
      if (this.routes.indexOf(route) < 0) {
        this.routes.push(route)
      }
    })
    let routes = this.routes
    return co(function * () {
      while (routes.length) {
        let n = 0
        yield routes.splice(0, 500).map((route) => {
          return co(function * () {
            yield waitFor(n++ * self.options.generate.interval)
            try {
              var { html, error } = yield self.renderRoute(route, { _generate: true })
              if (error) {
                errors.push({type: 'handled', route, error})
              }
            } catch (err) {
              errors.push({type: 'unhandled', route, error: err})
              return
            }
            try {
              var minifiedHtml = minify(html, self.options.generate.minify)
            } catch (err) {
              let minifyErr = new Error(`HTML minification failed. Make sure the route generates valid HTML. Failed HTML:\n ${html}`)
              errors.push({type: 'unhandled', route, error: minifyErr})
              return
            }
            var path = join(route, sep, 'index.html') // /about -> /about/index.html
            debug('Generate file: ' + path)
            path = join(distPath, path)
            // Make sure the sub folders are created
            yield mkdirp(dirname(path))
            yield writeFile(path, minifiedHtml, 'utf8')
          })
        })
      }
    })
  })
  .then((pages) => {
    // Add .nojekyll file to let Github Pages add the _nuxt/ folder
    // https://help.github.com/articles/files-that-start-with-an-underscore-are-missing/
    const nojekyllPath = resolve(distPath, '.nojekyll')
    return writeFile(nojekyllPath, '')
  })
  .then(() => {
    const duration = Math.round((Date.now() - s) / 100) / 10
    debug(`HTML Files generated in ${duration}s`)

    if (errors.length) {
      /* eslint-disable no-console */
      console.error('==== Error report ==== \n' + errors.map(({type, route, error}) => {
        if (type === 'unhandled') {
          return `Route: '${route}'\n${error.stack}`
        } else {
          return `Route: '${route}' thrown an error: \n` + JSON.stringify(error)
        }
      }).join('\n\n'))
    }
    return this
  })
}
