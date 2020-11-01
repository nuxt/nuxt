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
import esbuild from 'rollup-plugin-esbuild'

export type RollupConfig = InputOptions & { output: OutputOptions }

export const getRollupConfig = (config) => {
  const mocks = [
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
      file: path.resolve(config.buildDir, 'dist/server', `index.${config.target}.js`),
      format: 'cjs',
      intro: '',
      outro: '',
      preferConst: true
    },

    external,

    plugins: [
      replace({
        values: {
          'process.env.NODE_ENV': '"production"'
        }
      }),

      alias({
        entries: {
          '~runtime': path.resolve(__dirname, 'runtime'),
          '~build': config.buildDir,
          '~mock': require.resolve('./runtime/mock'),
          ...mocks.reduce((p, c) => ({ ...p, [c]: '~mock' }), {})
        }
      }),

      // https://github.com/rollup/plugins/tree/master/packages/node-resolve
      resolve({
        extensions,
        preferBuiltins: true,
        mainFields: ['main'] // Force resolve CJS (@vue/runtime-core ssrUtils)
      }),

      // https://github.com/rollup/plugins/tree/master/packages/commonjs
      commonjs({
        extensions: extensions.filter(ext => ext !== '.json'),
        dynamicRequireTargets: ['*.js']
      }),

      // https://github.com/egoist/rollup-plugin-esbuild
      esbuild({
        target: 'node12',
        include: /\.[jt]s?$/,
        tsconfig: false,
        sourceMap: false,
        loaders: {
          '.json': 'json',
          '.js': 'jsx',
          '.ts': 'ts'
        }
      }),

      // https://github.com/rollup/plugins/tree/master/packages/json
      json()
    ]
  }

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
