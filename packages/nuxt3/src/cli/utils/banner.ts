import consola from 'consola'
import env from 'std-env'
import chalk from 'chalk'

import { Nuxt } from 'src/core'
import { successBox } from './formatting'
import { getFormattedMemoryUsage } from './memory'

export function showBanner (nuxt: Nuxt, showMemoryUsage = true) {
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
  titleLines.push(`${chalk[bannerColor].bold('Nuxt.js')} @ ${nuxt.constructor.version || 'exotic'}\n`)

  const label = (name: string) => chalk.bold.cyan(`▸ ${name}:`)

  // Environment
  const isDev = nuxt.options.dev
  let _env = isDev ? 'development' : 'production'
  if (process.env.NODE_ENV !== _env) {
    _env += ` (${chalk.cyan(process.env.NODE_ENV)})`
  }
  titleLines.push(`${label('Environment')} ${_env}`)

  // Rendering
  const isSSR = nuxt.options.render.ssr
  const rendering = isSSR ? 'server-side' : 'client-side'
  titleLines.push(`${label('Rendering')}   ${rendering}`)

  // Target
  const target = nuxt.options.target || 'server'
  titleLines.push(`${label('Target')}      ${target}`)

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
