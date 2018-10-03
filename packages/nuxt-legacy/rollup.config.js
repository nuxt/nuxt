import babel from 'rollup-plugin-babel'
import config from '../nuxt-pack/rollup.config'

export default config({
  rootDir: __dirname,
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
