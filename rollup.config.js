import config from './packages/nuxt-pack/rollup.config'

export default config({
  rootDir: __dirname,
  input: './lib/index.js'
})
