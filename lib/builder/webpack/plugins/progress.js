const ProgressBar = require('node-progress-bars')
const webpack = require('webpack')
const throttle = require('lodash/debounce')

module.exports = class ProgressPlugin extends webpack.ProgressPlugin {
  constructor(options) {
    super(options)

    if (typeof options === 'function') {
      options = {
        handler: options
      }
    }

    this.handler = (percent, msg) => this.updateProgress(percent, msg)

    this.options = options || {}

    this.lastUpdate = 0

    // BUG: plugin.appy is being called twice!
    // So initialize progress here
    this.startProgress()

    this.lastPrgoress = 0
    this.lastMsg = ''
  }

  updateProgress(percent, msg) {
    if (!this.bar) {
      this.startProgress()
    }

    const progress = Math.floor(percent * 100)

    if (progress === this.lastPrgoress || msg === this.lastMsg) {
      return
    }

    this.lastPrgoress = progress
    this.lastMsg = msg

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

// -----------------------------------------------------------
// Shared console utils
// -----------------------------------------------------------
// let consoleSpied = 0

// const silentConsole = {}
// const originalConsole = {}
// const consoleQueue = {
//   log: [],
//   warn: [],
//   error: []
// }

// // level: log, warn, error
// Object.keys(consoleQueue).forEach((level) => {
//   silentConsole[level] = (...args) => consoleQueue[level].push(args)
//   originalConsole[level] = console[level] // eslint-disable-line no-console
// })

// const muteConsole = () => {
//   // eslint-disable-next-line no-console
//   if (console.spiedInTest) {
//     return
//   }

//   consoleSpied++

//   Object.assign(console, silentConsole)
// }

// const restoreConsole = () => {
//   if (consoleSpied === 0) {
//     return
//   }

//   consoleSpied--

//   Object.assign(console, originalConsole)

//   // level: log, warn, error
//   for (let level in consoleQueue) {
//     const q = consoleQueue[level]
//     consoleQueue[level] = []
//     q.forEach(args => console[level](...args)) // eslint-disable-line no-console
//   }
// }
