import json from 'rollup-plugin-json'
import commonjs from 'rollup-plugin-commonjs'
import defaultsDeep from 'lodash/defaultsDeep'

import externals from './externals'

export default ({ name, input, plugins = [], options }) => defaultsDeep({}, options, {
  input,
  output: {
    file: `dist/${name}.js`,
    format: 'cjs',
    sourcemap: true
  },
  external: externals,
  plugins: [
    commonjs(),
    json()
  ].concat(plugins)
})
