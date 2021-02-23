// Add polyfill imports to the first file encountered.
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
        const { addSideEffect, getModulePath } = require('@babel/helper-module-imports')

        // Imports are injected in reverse order
        polyfills.slice().reverse().forEach((p) => {
          addSideEffect(path, getModulePath(p))
        })
      }
    }
  }
}
