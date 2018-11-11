import { existsSync, readdirSync, parse } from 'path'

const filterCommands = (dir) => readdirSync(dir)
  .filter(c => c.endsWith('.js'))

export default {
  exists(cmd) {
    const cmdsHash = {}
    const cmdsRoot =  path.resolve('.', 'commands')
    if (existsSync(cmdsRoot)) {
      const cmds = 
      return cmds.includes(`${cmd}.js`)
    }
  },
  load (cmd) {
    const cmdsRoot =  path.resolve('.', 'commands')
    const cmds = filterCommands(cmdsRoot)
    return cmds.reduce((hash, cmd) => {
      return Object.assign(hash, {
        [parse(cmd).name]: import(path.join(cmdsRoot, cmd))
      })
    }, {})
  }
}
