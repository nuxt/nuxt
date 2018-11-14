import chalk from 'chalk'
import NuxtCommand from './command'
import { indent, foldLines, startSpaces, optionSpaces, colorize } from './utils/formatting'

const getFormattedCommands = (cmmds) => {
  let maxLength = 0
  const commandsHelp = []

  cmmds.forEach((cmd) => {
    commandsHelp.push([cmd.usage, cmd.description])
    maxLength = Math.max(maxLength, cmd.usage.length)
  })

  return commandsHelp.map(([cmd, description]) => {
    const i = indent(maxLength + optionSpaces - cmd.length)
    return foldLines(
      chalk.green(cmd) + i + description,
      startSpaces + maxLength + optionSpaces * 2,
      startSpaces + optionSpaces
    )
  }).join('\n')
}

export default async function listCommands() {
  const commandsOrder = ['dev', 'build', 'generate', 'start', 'run', 'help']
  const localCommands = NuxtCommand.list('.')

  const coreCmmds = await Promise.all(
    commandsOrder.map(cmd => NuxtCommand.load(cmd))
  )
  const customCmmds = await Promise.all(
    localCommands.map(cmd => NuxtCommand.load(cmd, '.'))
  )

  const usage = foldLines(`Usage: nuxt <command> [--help|-h]`, startSpaces)
  let helpText = foldLines(`Commands:`, startSpaces) +
    '\n\n' + getFormattedCommands(coreCmmds) + '\n\n'
  if (customCmmds.length) {
    helpText += foldLines(`Custom commands found in this project:`, startSpaces) +
      '\n\n' + getFormattedCommands(customCmmds) + '\n\n'
  }
  process.stderr.write(colorize(`${usage}\n\n${helpText}`))
  
}
