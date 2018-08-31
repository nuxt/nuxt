/*
** Core logic from https://github.com/sindresorhus/builtin-modules
** Many thanks to @sindresorhus
*/
const { builtinModules } = require('module')

const blacklist = [
  'sys'
]

const builtins = (builtinModules || Object.keys(process.binding('natives')))
  .filter(x => !/^_|^(internal|v8|node-inspect)\/|\//.test(x) && !blacklist.includes(x))
  .sort()

let builtinsObj = null

const convertToObj = () => builtins.reduce((obj, builtin) => {
  obj[builtin] = true
  return obj
}, (builtinsObj = {}))

export const builtinsMap = () => builtinsObj || convertToObj()
export default builtins
