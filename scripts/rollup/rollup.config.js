import json from 'rollup-plugin-json'
import commonjs from 'rollup-plugin-commonjs'
import license from 'rollup-plugin-license'
import defaultsDeep from 'lodash/defaultsDeep'
import { version } from '../../package.json'

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
    json(),
    license({
      banner: '/*!\n' +
        ' * Nuxt.js v' + version + '\n' +
        ' * (c) 2016-' + new Date().getFullYear() + '\n' +
        ' * - Sébastien Chopin (@Atinux)\n' +
        ' * - Alexandre Chopin (@alexchopin)\n' +
        ' * - Pooya Parsa (@pi0)\n' +
        ' * - Clark Du (@clarkdo)\n' +
        ' * - All the amazing contributors\n' +
        ' * Released under the MIT License.\n' +
        ' * Website: https://nuxtjs.org\n' +
        ' */'
    })
  ].concat(plugins)
})
