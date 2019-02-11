import serialize from 'serialize-javascript'

export function serializeFunction(func) {
  let open = false
  return serialize(func)
    .replace(serializeFunction.assignmentRE, (_, spaces) => {
      return `${spaces}: function (`
    })
    .replace(serializeFunction.internalFunctionRE, (_, spaces, name, args) => {
      if (open) {
        return `${spaces}${name}: function (${args}) {`
      } else {
        open = true
        return _
      }
    })
    .replace(`${func.name || 'function'}(`, 'function (')
}

serializeFunction.internalFunctionRE = /^(\s*)(?!(?:if)|(?:for)|(?:while)|(?:switch))(\w+)\s*\((.*?)\)\s*\{/gm
serializeFunction.assignmentRE = /^(\s*):(\w+)\(/gm
