const ProgressBar = require('node-progress-bars')
const webpack = require('webpack')

module.exports = function ProgressPlugin({ color, pcolor, title }) {
  // eslint-disable-next-line no-console
  if (!console.spiedInTest) {
    muteConsole()
  }

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

const silentConsole = {}
const originalConsole = {}
const consoleQueue = {
  log: [],
  warn: [],
  error: []
}

// level: log, warn, error
Object.keys(consoleQueue).forEach((level) => {
  silentConsole[level] = (...args) => consoleQueue[level].push(args)
  originalConsole[level] = console[level] // eslint-disable-line no-console
})

const muteConsole = () => {
  if (consoleSpied) return
  consoleSpied = true

  Object.assign(console, silentConsole)
}

const restoreConsole = () => {
  if (!consoleSpied) return
  consoleSpied = false

  Object.assign(console, originalConsole)

  // level: log, warn, error
  for (let level in consoleQueue) {
    consoleQueue[level].forEach(args => console[level](...args)) // eslint-disable-line no-console
    consoleQueue[level] = []
  }
}
