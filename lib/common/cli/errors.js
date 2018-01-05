const PrettyError = require('pretty-error')

// Start default instance
const pe = new PrettyError()

// Console error unhandled promises
process.on('unhandledRejection', function (err) {
  /* eslint-disable no-console */
  console.log(pe.render(err))
})

module.exports = {
  pe
}
