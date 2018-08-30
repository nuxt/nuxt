import babel from 'rollup-plugin-babel'
import config from '../../scripts/rollup.config'
import pkg from './package.json'

export default config({
  pkg,
  input: './src/index.js',
  plugins: [
    babel({
      exclude: 'node_modules/**',
      presets: [
        [
          '@babel/preset-env',
          {
            'modules': false
          }
        ]
      ]
    })
  ]
})
