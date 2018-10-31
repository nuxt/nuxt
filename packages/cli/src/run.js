import consola from 'consola'
import NuxtCommand from './command'
import * as commands from './commands'
import setup from './setup'
import { startSpaces, optionSpaces, maxCharsPerLine } from './formatting'

function listCommands() {
  const options = []
  let maxLength = 0

  const commandsHelp = Object.keys(commands).reduce((name, arr) => {
    return arr.concat([[commands[name].usage, commands[name].description]])
  }, [])

  const _cmmds = options.map(([cmd, description]) => {
    const i = indent(maxLength + optionSpaces - cmd.length)
    return foldLines(
      cmd + i + description,
      maxCharsPerLine,
      startSpaces + maxLength + optionSpaces * 2,
      startSpaces + optionSpaces
    )
  }).join('\n')

  const usage = foldLines(`Usage: nuxt <command>`, maxCharsPerLine, startSpaces)
  const cmmds = foldLines(`Commands:`, maxCharsPerLine, startSpaces) + '\n\n' + _cmmds
  return `${usage}\n\n${cmmds}\n\n`
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
      listCommands()
      process.exit(0) 
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
