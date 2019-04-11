import consola from 'consola'
import prettyBytes from 'pretty-bytes'
import env from 'std-env'
import chalk from 'chalk'
import { successBox } from './formatting'

export function showBanner(nuxt) {
  if (env.test) {
    return
  }

  if (env.minimalCLI) {
    for (const listener of nuxt.server.listeners) {
      consola.info('Listening on: ' + listener.url)
    }
    return
  }

  const titleLines = []
  const messageLines = []

  // Name and version
  titleLines.push(`${chalk.green.bold('Nuxt.js')} ${nuxt.constructor.version}`)

  // Running mode
  titleLines.push(`Running in ${nuxt.options.dev ? chalk.bold.blue('development') : chalk.bold.green('production')} mode (${chalk.bold(nuxt.options.mode)})`)

  if (nuxt.options._typescript && nuxt.options._typescript.runtime) {
    titleLines.push(`TypeScript support is ${chalk.green.bold('enabled')}`)
  }

  // https://nodejs.org/api/process.html#process_process_memoryusage
  const { heapUsed, rss } = process.memoryUsage()
  titleLines.push(`Memory usage: ${chalk.bold(prettyBytes(heapUsed))} (RSS: ${prettyBytes(rss)})`)

  // Listeners
  for (const listener of nuxt.server.listeners) {
    messageLines.push(chalk.bold('Listening on: ') + chalk.underline.blue(listener.url))
  }

  // Add custom badge messages
  if (nuxt.options.cli.badgeMessages.length) {
    messageLines.push('', ...nuxt.options.cli.badgeMessages)
  }

  process.stdout.write(successBox(messageLines.join('\n'), titleLines.join('\n')))
}
