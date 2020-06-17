import consola from 'consola'
import env from 'std-env'
import chalk from 'chalk'
import { stat } from 'fs-extra'
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
  titleLines.push(`${chalk[bannerColor].bold('Nuxt.js')}    ${nuxt.constructor.version}\n`)

  const label = name => chalk.bold.cyan(`▸ ${name}:`)

  // Stage
  const isDev = nuxt.options.dev
  let stage = isDev ? 'development' : 'production'
  if (process.env.NODE_ENV !== stage) {
    stage += ` (NODE_ENV=${process.env.NODE_ENV})`
  }
  titleLines.push(`${label('Stage')}   ${stage}`)

  // Mode
  const isSSR = nuxt.options.render.ssr
  const mode = isSSR ? 'server-side' : 'client-side'
  titleLines.push(`${label('Mode')}    ${mode}`)

  // Target
  const target = nuxt.options.target
  titleLines.push(`${label('Target')}  ${target}`)

  if (showMemoryUsage) {
    titleLines.push('\n' + getFormattedMemoryUsage())
  }

  // Listeners
  for (const listener of nuxt.server.listeners) {
    messageLines.push(chalk.bold('Listening: ') + chalk.underline.blue(listener.url))
  }

  // Add custom badge messages
  if (badgeMessages.length) {
    messageLines.push('', ...badgeMessages)
  }

  process.stdout.write(successBox(messageLines.join('\n'), titleLines.join('\n')))
}
