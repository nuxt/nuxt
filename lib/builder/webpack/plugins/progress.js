const webpack = require('webpack')
const chalk = require('chalk')
const _ = require('lodash')

const sharedState = {}

const BLOCK_CHAR = '█'

module.exports = class ProgressPlugin extends webpack.ProgressPlugin {
  constructor(options) {
    super(options)

    this.handler = (percent, msg) => this.updateProgress(percent, msg)

    this.options = options

    if (!sharedState[options.name]) {
      sharedState[options.name] = {
        color: options.color
      }
    }

    this.spinner = options.spinner
  }

  get state() {
    return sharedState[this.options.name]
  }

  updateProgress(percent, msg) {
    const progress = Math.floor(percent * 100)

    this.state.progress = progress
    this.state.succeed =
    this.state.msg = msg

    // Update spinner using shared state
    let isInProgress = false
    const width = 25
    let line = _.range(width).fill(chalk.white(BLOCK_CHAR))
    let additional = []

    Object.keys(sharedState).forEach(name => {
      const state = sharedState[name]

      if (state.progress >= 100) {
        return
      }

      isInProgress = true

      const w = state.progress * (width / 100)
      const b = chalk.keyword(state.color)(BLOCK_CHAR)

      for (let i = 0; i < w; i++) {
        line[i] = b
      }

      additional.push(`${b} ${name} (${state.progress}%) `)
    })

    if (isInProgress) {
      this.spinner.start()
      this.spinner.text = 'Compiling ' + line.join('') + '   ' + additional.join('   ')
    } else {
      this.spinner.succeed('Compiled ' + this.options.name)
    }
  }
}
