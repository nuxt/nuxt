
module.exports = function middlewareModule (options) {
  return new Promise((resolve, reject) => {
    // Add /api endpoint
    this.addServerMiddleware({
      path: '/api',
      handler (req, res, next) {
        res.end('It works!')
      }
    })
  })
}
