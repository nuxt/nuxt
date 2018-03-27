import nodeResolve from 'rollup-plugin-node-resolve'
import json from 'rollup-plugin-json'
import commonjs from 'rollup-plugin-commonjs'
import defaultsDeep from 'lodash/defaultsDeep'

export default ({ name, input, plugins = [], options }) => defaultsDeep({}, options, {
  input,
  output: {
    file: `dist/${name}.js`,
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      modulesOnly: true,
      preferBuiltins: true,
      extensions: ['.mjs', '.js']
    }),
    commonjs(),
    json()
  ].concat(plugins)
})
