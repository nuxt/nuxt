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
  const { bannerColor, badgeMessages } = nuxt.options.cli
  titleLines.push(`${chalk[bannerColor].bold('Nuxt.js')} ${nuxt.constructor.version}`)

  // Running mode
  const rendering = nuxt.options.render.ssr ? chalk.bold.yellow('universal') : chalk.bold.yellow('client-side')
  const envMode = nuxt.options.dev ? chalk.bold.blue('development') : chalk.bold.green('production')
  const sentence = `Running in ${envMode}, with ${rendering} rendering and ${chalk.bold.cyan(nuxt.options.target)} target.`
  titleLines.push(sentence)

  if (showMemoryUsage) {
    titleLines.push(getFormattedMemoryUsage())
  }

  // Listeners
  for (const listener of nuxt.server.listeners) {
    messageLines.push(chalk.bold('Listening on: ') + chalk.underline.blue(listener.url))
  }

  // Add custom badge messages
  if (badgeMessages.length) {
    messageLines.push('', ...badgeMessages)
  }

  process.stdout.write(successBox(messageLines.join('\n'), titleLines.join('\n')))
}
