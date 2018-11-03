import consola from 'consola'
import NuxtCommand from './command'
import * as commands from './commands'
import setup from './setup'
import { indent, foldLines, startSpaces, optionSpaces } from './utils/formatting'

async function listCommands(_commands) {
  _commands = await Promise.all(
    Object.keys(_commands).map(cmd => NuxtCommand.load(cmd))
  )
  let maxLength = 0
  const commandsHelp = []
  for (const name in _commands) {
    commandsHelp.push([_commands[name].usage, _commands[name].description])
    maxLength = Math.max(maxLength, _commands[name].usage.length)
  }

  const _cmmds = commandsHelp.map(([cmd, description]) => {
    const i = indent(maxLength + optionSpaces - cmd.length)
    return foldLines(
      cmd + i + description,
      startSpaces + maxLength + optionSpaces * 2,
      startSpaces + optionSpaces
    )
  }).join('\n')

  const usage = foldLines(`Usage: nuxt <command> [--help|-h]`, startSpaces)
  const cmmds = foldLines(`Commands:`, startSpaces) + '\n\n' + _cmmds
  process.stdout.write(`${usage}\n\n${cmmds}\n\n`)
}

export default function run() {
  const defaultCommand = 'dev'
  let cmd = process.argv[2]

  const _commands = { ...commands }
  if (_commands[cmd]) {
    process.argv.splice(2, 1)
  } else {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      listCommands(_commands).then(() => process.exit(0))
      return
    }
    cmd = defaultCommand
  }

  // Setup runtime
  setup({
    dev: cmd === 'dev'
  })

  return NuxtCommand.load(cmd)
    .then(command => command.run())
    .catch((error) => {
      consola.fatal(error)
    })
}
