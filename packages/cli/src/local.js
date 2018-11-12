import { resolve, join, parse } from 'path'
import { readdirSync, existsSync } from 'fs'
import { requireModule } from './utils'
import NuxtCommand from './command'

const filterCommands = (dir) => {
  return readdirSync(dir).filter(c => c.endsWith('.js'))
}

export function getLocalCommands() {
  const cmdsRoot = resolve('.', 'commands')
  const cmds = filterCommands(cmdsRoot)
  return cmds.map(cmd => parse(cmd).name)
}

export function existsLocalCommand(cmd) {
  const cmdsRoot = resolve('.', 'commands')
  if (existsSync(cmdsRoot)) {
    return filterCommands(cmdsRoot).includes(`${cmd}.js`)
  }
}

export function loadLocalCommand(cmd) {
  const cmdsRoot = resolve('.', 'commands')
  const file = filterCommands(cmdsRoot).find((c) => {
    return parse(c).name === cmd
  })
  const command = requireModule(join(cmdsRoot, file))
  return NuxtCommand.from(command.default)
}
