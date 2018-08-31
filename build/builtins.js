const { builtinModules } = require('module')

const blacklist = [
  'sys'
]

const builtins = (builtinModules || Object.keys(process.binding('natives')))
  .filter(x => !/^_|^(internal|v8|node-inspect)\/|\//.test(x) && !blacklist.includes(x))
  .sort()

export const builtinsMap = () => builtins.reduce((obj, builtin) => {
  obj[builtin] = true
  return obj
}, {})

export default builtins
