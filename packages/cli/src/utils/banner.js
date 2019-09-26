import consola from 'consola'
import env from 'std-env'
import chalk from 'chalk'
import { successBox } from './formatting'
import { getFormattedMemoryUsage } from './memory'

export function showBanner (nuxt, showMemoryUsage = true) {
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
  let titleColor = 'green'
  if (nuxt.options.build && nuxt.options.build.ui) {
    titleColor = nuxt.options.build.ui.titleColor
  }
  titleLines.push(`${chalk[titleColor].bold('Nuxt.js')} ${nuxt.constructor.version}`)

  // Running mode
  titleLines.push(`Running in ${nuxt.options.dev ? chalk.bold.blue('development') : chalk.bold.green('production')} mode (${chalk.bold(nuxt.options.mode)})`)

  if (showMemoryUsage) {
    titleLines.push(getFormattedMemoryUsage())
  }

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
