
import _app from './_app'
import _common from './_common'
import build from './build'
import messages from './messages'
import render from './render'
import router from './router'
import server from './server'
import cli from './cli'
import generate from './generate'

/*
TODO for top level normalizations: (nuxt2)
- transition => pageTransition
- export => generate
- gzip => compressor
- Apply preset
- render.etag.hash should be a function
- deprecated devModules
- set consola level to 0 if build.quite is true
- Ad-hoc: loading-screen, components and telemtry
- build.indicator and build.loadingScreen
- build.crossorigin => render.crossorigin
- render.csp.unsafeInlineCompatiblity => render.csp.unsafeInlineCompatibility
- guards: rootDir:buildDir rootDir:generate.dir srcDir:buildDir srcDir:generate.dir
- _publicPath (original value of publicPath)
- options.build.babel.presets (array) warn @nuxtjs/babel-preset-app => @nuxt/babel-preset-app
*/

export default {
  ..._app,
  ..._common,
  build,
  messages,
  render,
  router,
  server,
  cli,
  generate
}
