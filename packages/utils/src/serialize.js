import serialize from 'serialize-javascript'

function normalizeFunctions(obj) {
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) {
    return
  }
  for (const key in obj) {
    if (key === '__proto__' || key === 'constructor') {
      continue
    }
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(obj)) {
      normalizeFunctions(val)
    }
    if (typeof obj[key] === 'function') {
      // This will cause an arrow function to be normalized into function() {}
      // eslint-disable-next-line no-new-func
      obj[key] = new Function(obj[key])
    }
  }
  return obj
}

export function serializeFunction(func) {
  let open = false
  func = normalizeFunctions(func)
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
