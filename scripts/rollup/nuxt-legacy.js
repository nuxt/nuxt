import babel from 'rollup-plugin-babel'

import config from './rollup.config'

export default config({
  name: 'nuxt-legacy',
  input: './lib/nuxt-legacy.js',
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
      ],
      plugins: [
        'external-helpers'
      ]
    })
  ]
})
