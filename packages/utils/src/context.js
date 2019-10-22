
export const getContext = function getContext (req, res) {
  return { req, res }
}

export const determineGlobals = function determineGlobals (globalName, globals) {
  const _globals = {}
  for (const global in globals) {
    if (typeof globals[global] === 'function') {
      _globals[global] = globals[global](globalName)
    } else {
      _globals[global] = globals[global]
    }
  }
  return _globals
}
