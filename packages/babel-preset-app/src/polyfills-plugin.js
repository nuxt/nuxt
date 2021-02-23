// Add polyfill imports to the first file encountered.
const { addSideEffect } = require('@babel/helper-module-imports')

const modulePathMap = {
  'regenerator-runtime': 'regenerator-runtime/runtime.js'
}

function getModulePath (mod) {
  return modulePathMap[mod] || 'core-js/modules/' + mod + '.js'
}

function createImport (path, mod) {
  return addSideEffect(path, getModulePath(mod))
}

module.exports = ({ types }) => {
  let entryFile
  return {
    name: 'inject-polyfills',
    visitor: {
      Program (path, state) {
        if (!entryFile) {
          entryFile = state.filename
        } else if (state.filename !== entryFile) {
          return
        }

        const { polyfills } = state.opts

        // Imports are injected in reverse order
        polyfills.slice().reverse().forEach((p) => {
          createImport(path, p)
        })
      }
    }
  }
}
