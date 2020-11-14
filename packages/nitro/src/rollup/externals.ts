import { isAbsolute, relative } from 'path'

export function externals ({ include = [], relativeTo }) {
  return {
    name: 'externals',
    resolveId (source) {
      if (
        source[0] === '.' || // Compile relative imports
        source[0] === '\x00' || // Skip helpers
        source.includes('?') || // Skip helpers
        include.find(i => source.startsWith(i))
      ) { return null }

      if (!isAbsolute(source)) {
        source = require.resolve(source)
      }

      return {
        id: relative(relativeTo, source),
        external: true
      }
    }
  }
}
