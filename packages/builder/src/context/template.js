import hash from 'hash-sum'
import consola from 'consola'
import { uniqBy } from 'lodash'
import serialize from 'serialize-javascript'

import devalue from '@nuxt/devalue'
import { r, wp, wChunk, serializeFunction, isFullStatic, requireModule } from '@nuxt/utils'

export default class TemplateContext {
  constructor (builder, options) {
    this.templateFiles = Array.from(builder.template.files)
    this.templateVars = {
      nuxtOptions: options,
      features: options.features,
      extensions: options.extensions
        .map(ext => ext.replace(/^\./, ''))
        .join('|'),
      messages: options.messages,
      splitChunks: options.build.splitChunks,
      uniqBy,
      isDev: options.dev,
      isTest: options.test,
      isFullStatic: isFullStatic(options),
      debug: options.debug,
      buildIndicator: options.dev && options.build.indicator,
      vue: { config: options.vue.config },
      fetch: options.fetch,
      mode: options.mode,
      router: options.router,
      env: options.env,
      head: options.head,
      store: options.features.store ? options.store : false,
      globalName: options.globalName,
      globals: builder.globals,
      css: options.css,
      plugins: builder.plugins,
      appPath: './App.js',
      layouts: Object.assign({}, options.layouts),
      loading:
        typeof options.loading === 'string'
          ? builder.relativeToBuild(options.srcDir, options.loading)
          : options.loading,
      pageTransition: options.pageTransition,
      layoutTransition: options.layoutTransition,
      rootDir: options.rootDir,
      srcDir: options.srcDir,
      dir: options.dir,
      components: {
        ErrorPage: options.ErrorPage
          ? builder.relativeToBuild(options.ErrorPage)
          : null
      }
    }
  }

  get templateOptions () {
    let lodash = null

    return {
      imports: {
        serialize,
        serializeFunction,
        devalue,
        hash,
        r,
        wp,
        wChunk,
        // Legacy support: https://github.com/nuxt/nuxt.js/issues/4350
        _: new Proxy({}, {
          get (target, prop) {
            if (!lodash) {
              consola.warn('Avoid using _ inside templates')
              lodash = requireModule('lodash')
            }
            return lodash[prop]
          }
        })
      },
      interpolate: /<%=([\s\S]+?)%>/g
    }
  }
}
