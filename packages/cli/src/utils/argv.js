// ['node', 'nuxt', 'foo', '--bar'] => ['foo', '--bar']
export function normalizeArgv(argv) {
  let _argv = Array.from(argv)
  const nuxtIndex = _argv.findIndex(arg => arg.match(/nuxt(?:-cli)?(?:\.js)?$/)) + 1
  _argv = _argv.slice(nuxtIndex)
  if (!_argv[0] || _argv[0][0] === '-') {
    _argv.unshift('default')
  }
  return _argv
}

// ['foo', 'baz' '--bar'] => { command: 'foo-baz', opts: [ '--bar' ] }
export function parseArgv(argv) {
  let command = ''
  let opts = []

  const firstArgIndex = argv.findIndex(a => a[0] === '-')

  if (firstArgIndex === -1) {
    command = argv.join('-')
  } else {
    const _argv = Array.from(argv)
    command = _argv.splice(0, firstArgIndex).join('-')
    opts = _argv
  }

  return {
    command,
    opts
  }
}

/**
 * Normalize string argument in command
 *
 * @export
 * @param {String} argument
 * @param {*} defaultValue
 * @returns formatted argument
 */
export function normalizeArg(arg, defaultValue) {
  switch (arg) {
    case 'true': arg = true; break
    case '': arg = true; break
    case 'false': arg = false; break
    case undefined: arg = defaultValue; break
  }
  return arg
}
