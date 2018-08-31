import path from 'path'
import Package from './package'

// Commons
const rootDir = path.resolve(__dirname, '..')

// Force NODE_ENV to production
process.env.NODE_ENV = 'production'

// Packages
const packages = [
  '.',
  'packages/nuxt-start',
  'packages/nuxt-legacy'
]

// Build all packages
packages
  .map(p => path.resolve(rootDir, p))
  .map(p => new Package({ rootDir: path.resolve(rootDir, p) }))
  .forEach(pkg => pkg.build())
