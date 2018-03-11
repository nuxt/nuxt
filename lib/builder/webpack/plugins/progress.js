const ProgressBar = require('node-progress-bars')
const webpack = require('webpack')

module.exports = function ProgressPlugin({ color, pcolor, title }) {
  // https://github.com/bubkoo/ascii-progress
  const bar = new ProgressBar({
    schema: `${title}.${color} >.grey :filled.${pcolor}:blank.white :msg.grey`,
    filled: '█',
    blank: '█',
    total: 100,
    width: 25,
    clear: true
  })

  return new webpack.ProgressPlugin((percent, msg) => {
    bar.update(percent, { msg })
  })
}
