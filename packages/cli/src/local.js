import { resolve, readdirSync, existsSync, parse } from 'path'
import NuxtCommand from './command'

const filterCommands = (dir) => readdirSync(dir)
  .filter(c => c.endsWith('.js'))

export default {
  hash() {
    const cmdsRoot =  resolve('.', 'commands')
    const cmds = filterCommands(cmdsRoot)
    return cmds.reduce((hash, cmd) => {
      return Object.assign(hash, {
        [parse(cmd).name]: import(path.join(cmdsRoot, cmd))
      })
    }, {})
  }
  exists(cmd) {
    const cmdsHash = {}
    const cmdsRoot =  resolve('.', 'commands')
    if (existsSync(cmdsRoot)) {
      return filterCommands(cmdsRoot).includes(`${cmd}.js`)
    }
  },
  load (cmd) {
    const cmdsRoot =  resolve('.', 'commands')
    const file = filterCommands(cmdsRoot).find((c) => {
      return parse(c).name === cmd
    })
    const command = await import(path.join(cmdsRoot, command))
      .then(m => m.default)
    return NuxtCommand.from(command)
  }
}
