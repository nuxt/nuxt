import pkg from '../../package.json'

// Dependencies that will be installed alongise with nuxt package
const packageDependencies = Object.keys(pkg.dependencies)

// Allow built in node modules
const nodeBuiltIn = ['path', 'fs', 'module', 'crypto', 'util']

const externals = [].concat(
  packageDependencies,
  nodeBuiltIn
)

export default externals
