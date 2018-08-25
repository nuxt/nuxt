
export default class StatsPlugin {
  constructor(statsOptions) {
    this.statsOptions = statsOptions
  }

  apply(compiler) {
    compiler.hooks.done.tap('stats-plugin', (stats) => {
      process.stdout.write(
        '\n' +
          stats.toString(this.statsOptions) +
          '\n'
      )
    })
  }
}
