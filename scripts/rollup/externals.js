import pkg from '../../package.json'

// Dependencies that will be installed alongise with nuxt package
const packageDependencies = Object.keys(pkg.dependencies)

// Allow built in node modules
const nodeBuiltIn = ['path', 'fs', 'module', 'crypto', 'util']

// Optional dependencies that user should install on demand
const optionalDependencies = [
  // legacy build users need this
  '@babel/polyfill'
]

const externals = [].concat(
  packageDependencies,
  nodeBuiltIn,
  optionalDependencies
)

export default externals
