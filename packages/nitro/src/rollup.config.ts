import Module from 'module'
import path from 'path'
import { InputOptions, OutputOptions } from 'rollup'
import { terser } from 'rollup-plugin-terser'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import alias from '@rollup/plugin-alias'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import analyze from 'rollup-plugin-analyzer'
import ts from 'rollup-plugin-ts'

export type RollupConfig = InputOptions & { output: OutputOptions }

export const getRollupConfig = (config) => {
  const mocks = [
    // @nuxt/devalue
    'consola',
    // vue2
    'encoding',
    'he',
    'resolve',
    'source-map',
    'lodash.template',
    'serialize-javascript',
    // vue3
    '@babel/parser',
    '@vue/compiler-core',
    '@vue/compiler-dom',
    '@vue/compiler-ssr'
  ]

  const extensions = ['.ts', '.mjs', '.js', '.json', '.node']

  const external = []

  if (config.node === false) {
    mocks.push(...Module.builtinModules)
  } else {
    external.push(...Module.builtinModules)
  }

  const options: RollupConfig = {
    input: config.entry,
    output: {
      file: path.resolve(config.buildDir, `dist/${config.target}`, 'index.js'),
      format: 'cjs',
      intro: '',
      outro: '',
      preferConst: true
    },
    external,
    plugins: []
  }

  // https://github.com/rollup/plugins/tree/master/packages/replace
  options.plugins.push(replace({
    values: {
      'process.env.NODE_ENV': '"production"'
    }
  }))

  // Preserve dynamic require
  // https://github.com/rollup/plugins/tree/master/packages/replace
  options.output.intro += 'const requireDynamic = require;'
  options.plugins.push(replace({
    values: {
      'require("./" +': 'requireDynamic("../server/" +'
    },
    delimiters: ['', '']
  }))

  // https://github.com/rollup/plugins/tree/master/packages/alias
  options.plugins.push(alias({
    entries: {
      '~runtime': path.resolve(__dirname, 'runtime'),
      '~rendertostring': config.nuxt === 2 ? require.resolve('./runtime/vue2') : require.resolve('./runtime/vue3'),
      '~build': config.buildDir,
      '~mock': require.resolve('./runtime/mock'),
      ...mocks.reduce((p, c) => ({ ...p, [c]: '~mock' }), {})
    }
  }))

  // https://github.com/wessberg/rollup-plugin-ts
  options.plugins.push(ts({
    transpileOnly: true,
    transpiler: 'babel',
    include: ['**/*.ts'],
    exclude: ['*.json', 'node_modules']
  }))

  // https://github.com/rollup/plugins/tree/master/packages/node-resolve
  options.plugins.push(resolve({
    extensions,
    preferBuiltins: true,
    rootDir: config.rootDir,
    // https://www.npmjs.com/package/resolve
    customResolveOptions: {
      basedir: config.rootDir
    },
    mainFields: ['main'] // Force resolve CJS (@vue/runtime-core ssrUtils)
  }))

  // https://github.com/rollup/plugins/tree/master/packages/commonjs
  options.plugins.push(commonjs({
    extensions: extensions.filter(ext => ext !== '.json')
  }))

  // https://github.com/rollup/plugins/tree/master/packages/json
  options.plugins.push(json())

  if (config.logStartup) {
    options.output.intro += 'global._startTime = process.hrtime();'
    // eslint-disable-next-line no-template-curly-in-string
    options.output.outro += 'global._endTime = process.hrtime(global._startTime); global._coldstart = ((_endTime[0] * 1e9) + _endTime[1]) / 1e6; console.log(`λ Cold start took: ${global._coldstart}ms`);'
  }

  if (config.analyze) {
    // https://github.com/doesdev/rollup-plugin-analyzer
    options.plugins.push(analyze())
  }

  if (config.minify) {
    options.plugins.push(terser())
  }

  return options
}
