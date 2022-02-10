
import _adhoc from './_adhoc'
import _app from './_app'
import _common from './_common'
import _internal from './_internal'
import build from './build'
import messages from './messages'
import render from './render'
import router from './router'
import server from './server'
import cli from './cli'
import generate from './generate'
import typescript from './typescript'
import nitro from './nitro'

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
  ..._adhoc,
  ..._app,
  ..._common,
  ..._internal,
  ...nitro,
  build,
  messages,
  render,
  router,
  server,
  cli,
  generate,
  typescript,

  /**
   * Configuration that will be passed directly to Vite.
   *
   * See https://vitejs.dev/config for more information.
   * Please note that not all vite options are supported in Nuxt.
   *
   * @type {boolean | typeof import('vite').InlineConfig}
   * @version 3
   */
  vite: undefined,
}
