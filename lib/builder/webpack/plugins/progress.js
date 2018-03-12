const ProgressBar = require('node-progress-bars')
const webpack = require('webpack')

module.exports = function ProgressPlugin({ color, pcolor, title }) {
  muteConsole()

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

    if (percent >= 0.99) {
      restoreConsole()
    }
  })
}

// -----------------------------

let consoleSpied = false

const consoleQueue = {
  log: [],
  error: []
}

const silentConsole = {
  log: (...args) => consoleQueue.log.push(args),
  error: (...args) => consoleQueue.error.push(args)
}

const muteConsole = () => {
  if (consoleSpied) return
  consoleSpied = true

  Object.assign(console, silentConsole)
}

const originalConsole = {
  log: console.log, // eslint-disable-line no-console
  error: console.error // eslint-disable-line no-console
}

const restoreConsole = () => {
  if (!consoleSpied) return
  consoleSpied = false

  Object.assign(console, originalConsole)

  const l = consoleQueue.log
  consoleQueue.log = []
  l.forEach(args => console.log(...args)) // eslint-disable-line no-console

  const e = consoleQueue.error
  consoleQueue.error = []
  e.forEach(args => console.error(...args)) // eslint-disable-line no-console
}
