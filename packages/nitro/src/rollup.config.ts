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
import dynamicRequire from './dynamic-require'

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
      file: path.resolve(config.outDir, config.outName),
      format: 'cjs',
      intro: '',
      outro: '',
      preferConst: true
    },
    external,
    plugins: []
  }

  if (config.logStartup) {
    options.output.intro += 'global._startTime = process.hrtime();'
    // eslint-disable-next-line no-template-curly-in-string
    options.output.outro += 'global._endTime = process.hrtime(global._startTime); global._coldstart = ((global._endTime[0] * 1e9) + global._endTime[1]) / 1e6; console.log(`λ Cold start took: ${global._coldstart}ms`);'
  }

  // https://github.com/rollup/plugins/tree/master/packages/replace
  options.plugins.push(replace({
    values: {
      'process.env.NODE_ENV': '"production"'
    }
  }))

  // Dynamic Require Support
  options.plugins.push(dynamicRequire({
    dir: path.resolve(config.buildDir, 'dist/server'),
    globbyOptions: {
      ignore: [
        'server.js'
      ]
    }
  }))

  // https://github.com/rollup/plugins/tree/master/packages/alias
  const renderer = config.renderer || (config.nuxt === 2 ? 'vue2' : 'vue3')
  options.plugins.push(alias({
    entries: {
      '~runtime': path.resolve(__dirname, 'runtime'),
      '~renderer': require.resolve('./runtime/' + renderer),
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

  if (config.analyze) {
    // https://github.com/doesdev/rollup-plugin-analyzer
    options.plugins.push(analyze())
  }

  if (config.minify) {
    options.plugins.push(terser())
  }

  return options
}
