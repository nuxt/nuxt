const ProgressBar = require('node-progress-bars')
const webpack = require('webpack')
const throttle = require('lodash/throttle')

module.exports = class ProgressPlugin extends webpack.ProgressPlugin {
  constructor(options) {
    super(options)

    this.handler = (percent, msg) => this.updateProgress(percent, msg)

    this.options = options || {}

    this.lastUpdate = 0

    // BUG: plugin.appy is being called twice!
    // So initialize progress here
    this.startProgress()
  }

  updateProgress(percent, msg) {
    if (!this.bar) {
      this.startProgress()
    }

    if (percent === 1) {
      this.stopProgress()
      return
    }

    this.bar.update(percent, { msg })
  }

  startProgress() {
    if (this.bar) {
      this.stopProgress()
    }

    // https://github.com/bubkoo/ascii-progress
    this.bar = new ProgressBar({
      schema: `${this.options.title}.${this.options.color} >.grey :filled.${this.options.pcolor}:blank.white :msg.grey`,
      filled: '█',
      blank: '█',
      total: 100,
      width: 25,
      clear: true
    })

    this.bar.update = throttle(this.bar.update, 50)
  }

  stopProgress() {
    if (!this.bar) {
      return
    }

    this.bar.terminate()
    this.bar = undefined
  }
}
