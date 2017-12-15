// Taken from https://github.com/egoist/poi/blob/3e93c88c520db2d20c25647415e6ae0d3de61145/packages/poi/lib/webpack/timefix-plugin.js#L1-L16
// Thanks to @egoist
module.exports = class TimeFixPlugin {
  constructor(timefix = 11000) {
    this.timefix = timefix
  }

  apply(compiler) {
    compiler.plugin('watch-run', (watching, callback) => {
      watching.startTime += this.timefix
      callback()
    })

    compiler.plugin('done', stats => {
      stats.startTime -= this.timefix
    })
  }
}
