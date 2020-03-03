import hash from 'hash-sum'
import consola from 'consola'
import serialize from 'serialize-javascript'

import devalue from '@nuxt/devalue'
import { r, wp, wChunk, serializeFunction } from '@nuxt/utils'
import TemplateContext from '../../src/context/template'

jest.mock('lodash', () => ({ test: 'test lodash', warn: 'only once' }))

describe('builder: buildContext', () => {
  const builder = {
    template: { files: ['template.js'] },
    globals: ['globals'],
    plugins: ['plugins'],
    relativeToBuild: jest.fn((...args) => `relativeBuild(${args.join(', ')})`)
  }
  const options = {
    features: { store: true },
    extensions: ['test', 'ext'],
    messages: { test: 'test message' },
    build: {
      splitChunks: { testSC: true }
    },
    dev: 'test_dev',
    test: 'test_test',
    debug: 'test_debug',
    vue: { config: 'test_config' },
    mode: 'test mode',
    router: { route: 'test' },
    env: 'test_env',
    head: 'test_head',
    store: 'test_store',
    globalName: 'test_global',
    css: ['test.css'],
    layouts: {
      'test-layout': 'test.template'
    },
    srcDir: 'test_src_dir',
    rootDir: 'test_root_dir',
    loading: 'test-loading',
    pageTransition: { name: 'test_trans' },
    layoutTransition: { name: 'test_layout_trans' },
    dir: ['test_dir'],
    ErrorPage: 'test_error_page'
  }

  test('should construct context', () => {
    const context = new TemplateContext(builder, options)
    expect(context).toMatchSnapshot()
  })

  test('should return object loading template options', () => {
    const context = new TemplateContext(builder, {
      ...options,
      loading: { name: 'test_loading' }
    })

    expect(context.templateVars.loading).toEqual({ name: 'test_loading' })
  })

  test('should return object loading template options', () => {
    const context = new TemplateContext(builder, options)
    const templateOptions = context.templateOptions
    expect(templateOptions).toEqual({
      imports: {
        serialize,
        serializeFunction,
        devalue,
        hash,
        r,
        wp,
        wChunk,
        _: {}
      },
      interpolate: /<%=([\s\S]+?)%>/g
    })
    expect(templateOptions.imports._.test).toEqual('test lodash')
    expect(templateOptions.imports._.warn).toEqual('only once')
    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith('Avoid using _ inside templates')
  })
})
