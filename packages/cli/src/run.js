import consola from 'consola'
import NuxtCommand from './command'
import * as commands from './commands'
import setup from './setup'
import * as fmt from './formatting'

async function listCommands(_commands) {
  _commands = await Promise.all(
    Object.keys(_commands).map((cmd) => {
      return _commands[cmd]().then(m => m.default)
    })
  )
  let maxLength = 0
  const commandsHelp = []
  for (const name in _commands) {
    commandsHelp.push([_commands[name].usage, _commands[name].description])
    maxLength = Math.max(maxLength, _commands[name].usage.length)
  }

  const maxCharsPerLine = process.stdout.columns * 80 / 100
  const _cmmds = commandsHelp.map(([cmd, description]) => {
    const i = fmt.indent(maxLength + fmt.optionSpaces - cmd.length)
    return fmt.foldLines(
      cmd + i + description,
      maxCharsPerLine,
      fmt.startSpaces + maxLength + fmt.optionSpaces * 2,
      fmt.startSpaces + fmt.optionSpaces
    )
  }).join('\n')

  const usage = fmt.foldLines(`Usage: nuxt <command>`, maxCharsPerLine, fmt.startSpaces)
  const cmmds = fmt.foldLines(`Commands:`, maxCharsPerLine, fmt.startSpaces) + '\n\n' + _cmmds
  process.stdout.write(`${usage}\n\n${cmmds}\n\n`)
}

export default function run() {
  const defaultCommand = 'dev'

  const cmds = new Set([
    defaultCommand,
    'build',
    'start',
    'generate'
  ])

  let cmd = process.argv[2]

  if (cmds.has(cmd)) {
    process.argv.splice(2, 1)
  } else {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      listCommands({ ...commands }).then(() => process.exit(0))
      return
    }
    cmd = defaultCommand
  }

  // Setup runtime
  setup({
    dev: cmd === 'dev'
  })

  return commands[cmd]() // eslint-disable-line import/namespace
    .then(m => m.default)
    .then(options => NuxtCommand.from(options))
    .then(command => command.run())
    .catch((error) => {
      consola.fatal(error)
    })
}
