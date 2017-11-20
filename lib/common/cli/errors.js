const PrettyError = require('pretty-error')

// Start default instance
const pe = PrettyError.start()

// Configure prettyError instance
pe.skipPackage('regenerator-runtime')
pe.skipPackage('babel-runtime')
pe.skipPackage('core-js')

// Skip dist artifacts and Node internals
const skipFiles = [ 'nuxt.js', 'core.js' ]
pe.skip((traceLine, lineNumber) => {
  if (!traceLine.file || skipFiles.indexOf(traceLine.file) !== -1) {
    return true
  }
})

pe.skipNodeFiles()

// Console error unhandled promises
process.on('unhandledRejection', function (err) {
  /* eslint-disable no-console */
  console.log(pe.render(err))
})

module.exports = {
  pe
}
