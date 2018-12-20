import chalk from 'chalk'
import { indent, foldLines, startSpaces, optionSpaces, colorize } from './utils/formatting'
import getCommand from './commands'

export default async function listCommands() {
  const commandsOrder = ['dev', 'build', 'generate', 'start', 'help']

  // Load all commands
  const _commands = await Promise.all(
    commandsOrder.map(cmd => getCommand(cmd))
  )

  let maxLength = 0
  const commandsHelp = []

  for (const name in _commands) {
    commandsHelp.push([_commands[name].usage, _commands[name].description])
    maxLength = Math.max(maxLength, _commands[name].usage.length)
  }

  const _cmds = commandsHelp.map(([cmd, description]) => {
    const i = indent(maxLength + optionSpaces - cmd.length)
    return foldLines(
      chalk.green(cmd) + i + description,
      startSpaces + maxLength + optionSpaces * 2,
      startSpaces + optionSpaces
    )
  }).join('\n')

  const usage = foldLines(`Usage: nuxt <command> [--help|-h]`, startSpaces)
  const cmds = foldLines(`Commands:`, startSpaces) + '\n\n' + _cmds

  process.stderr.write(colorize(`${usage}\n\n${cmds}\n\n`))
}
