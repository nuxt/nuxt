import webpack from 'webpack'
import chalk from 'chalk'
import _ from 'lodash'

const sharedState = {}

const BLOCK_CHAR = '█'

export default class ProgressPlugin extends webpack.ProgressPlugin {
  constructor(options) {
    super(options)

    this.handler = (percent, msg, ...details) => this.updateProgress(percent, msg, details)

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

  updateProgress(percent, msg, details) {
    const progress = Math.floor(percent * 100)

    this.state.progress = progress
    this.state.msg = msg

    // Process all states
    let inProgress = false

    const additional = []

    const bars = Object.keys(sharedState).map(name => {
      const state = sharedState[name]

      if (state.progress < 100) {
        inProgress = true
      }

      const blockChar = chalk.keyword(state.color)(BLOCK_CHAR)

      additional.push(`${blockChar} ${name} (${state.progress}%) `)

      return {
        name,
        color: state.color,
        progress: state.progress,
        blockChar: chalk.keyword(state.color)(BLOCK_CHAR)
      }
    })

    if (!inProgress) {
      this.spinner.succeed('Compiled ' + this.options.name)
      return
    }

    // Generate progressbars

    const width = 25
    const progressbars = _.range(width).fill(chalk.white(BLOCK_CHAR))

    _.sortBy(bars, 'progress').reverse().forEach(bar => {
      const w = bar.progress * (width / 100)

      for (let i = 0; i < w; i++) {
        progressbars[i] = bar.blockChar
      }
    })

    // Update spinner
    this.spinner.start()
    this.spinner.text = _.startCase(msg) + ' ' + progressbars.join('') + '   ' + additional.join('   ')
  }
}
