
export const getContext = function getContext(req, res) {
  return { req, res }
}

export const determineGlobals = function determineGlobals(globalName, globals) {
  const _globals = {}
  for (const global in globals) {
    // 함수이면
    if (typeof globals[global] === 'function') {
      // 각 function들에 globalName 넣음
      _globals[global] = globals[global](globalName)
    } else {
      _globals[global] = globals[global]
    }
  }
  // 그래서 리턴해줌
  return _globals
}
