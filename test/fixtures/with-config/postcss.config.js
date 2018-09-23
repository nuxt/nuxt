const path = require('path')
const modulesDir = path.join(__dirname, '..', '..', '..', 'node_modules')
const rootDir = __dirname

export default {
  plugins: {
    'postcss-import': {
      root: rootDir,
      path: [rootDir, modulesDir]
    },
    'postcss-url': {},
    'postcss-preset-env': {}
  }
}
