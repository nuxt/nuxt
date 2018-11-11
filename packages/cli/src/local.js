import { resolve, join, readdirSync, existsSync, parse } from 'path'
import NuxtCommand from './command'

const filterCommands = (dir) => {
  return readdirSync(dir).filter(c => c.endsWith('.js'))
}

export function getLocalCommands() {
  const cmdsRoot = resolve('.', 'commands')
  const cmds = filterCommands(cmdsRoot)
  return cmds.reduce((hash, cmd) => {
    return Object.assign(hash, {
      [parse(cmd).name]: import(join(cmdsRoot, cmd))
    })
  }, {})
}

export function localCommandExists(cmd) {
  const cmdsRoot =  resolve('.', 'commands')
  if (existsSync(cmdsRoot)) {
    return filterCommands(cmdsRoot).includes(`${cmd}.js`)
  }
}

export async function localCommandLoad (cmd) {
  const cmdsRoot =  resolve('.', 'commands')
  const file = filterCommands(cmdsRoot).find((c) => {
    return parse(c).name === cmd
  })
  const command = await import(path.join(cmdsRoot, command))
    .then(m => m.default)
  return NuxtCommand.from(command)
}
