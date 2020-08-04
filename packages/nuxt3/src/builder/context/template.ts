import hash from 'hash-sum'
import consola from 'consola'
import uniqBy from 'lodash/uniqBy'
import serialize from 'serialize-javascript'

import devalue from '@nuxt/devalue'
import { r, wp, wChunk, serializeFunction, isFullStatic } from 'src/utils'

export default class TemplateContext {
  constructor(builder, options) {
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
    return {
      imports: {
        serialize,
        serializeFunction,
        devalue,
        hash,
        r,
        wp,
        wChunk,
      },
      interpolate: /<%=([\s\S]+?)%>/g
    }
  }
}
