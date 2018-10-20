import path from 'path'
import { existsSync } from 'fs'
import consola from 'consola'
import esm from 'esm'

const _require = esm(module, {
  cache: false,
  cjs: {
    cache: true,
    vars: true,
    namedExports: true
  }
})

const getRootDir = argv => path.resolve(argv._[0] || '.')
const getNuxtConfigFile = argv => path.resolve(getRootDir(argv), argv['config-file'])
const getLatestHost = (argv) => {
  const port =
    argv.port ||
    process.env.NUXT_PORT ||
    process.env.PORT ||
    process.env.npm_package_config_nuxt_port
  const host =
    argv.hostname ||
    process.env.NUXT_HOST ||
    process.env.HOST ||
    process.env.npm_package_config_nuxt_host
  const socket =
    argv['unix-socket'] ||
    process.env.UNIX_SOCKET ||
    process.env.npm_package_config_unix_socket

  return { port, host, socket }
}

export async function loadNuxtConfig(argv) {
  const rootDir = getRootDir(argv)
  const nuxtConfigFile = getNuxtConfigFile(argv)

  let options = {}

  if (existsSync(nuxtConfigFile)) {
    delete require.cache[nuxtConfigFile]
    options = _require(nuxtConfigFile) || {}
    if (options.default) {
      options = options.default
    }

    if (typeof options === 'function') {
      try {
        options = await options()
        if (options.default) {
          options = options.default
        }
      } catch (error) {
        consola.error(error)
        consola.fatal('Error while fetching async configuration')
      }
    }
  } else if (argv['config-file'] !== 'nuxt.config.js') {
    consola.fatal('Could not load config file: ' + argv['config-file'])
  }
  if (typeof options.rootDir !== 'string') {
    options.rootDir = rootDir
  }

  // Nuxt Mode
  options.mode =
    (argv.spa && 'spa') || (argv.universal && 'universal') || options.mode

  // Server options
  if (!options.server) {
    options.server = {}
  }

  const { port, host, socket } = getLatestHost(argv)
  options.server.port = port || options.server.port || 3000
  options.server.host = host || options.server.host || 'localhost'
  options.server.socket = socket || options.server.socket

  return options
}

export function indent(count, chr = ' ') {
  return chr.repeat(count)
}

//
// Folds a string at a specified length, optionally attempting
// to insert newlines after whitespace characters.
//
// s          -  input string
// n          -  number of chars at which to separate lines
// iN         -  indentation count at start of line
// foldAny    -  if true, fold on whole words
// a          -  array used to build result
//
// Returns an array of strings that are no longer than n
// characters long.  If a is specified as an array, the lines
// found in s will be pushed onto the end of a.
//
// If s is huge and n is very small, this method will have
// problems... StackOverflow.
//
const lastSpaceRgx = /\s(?!.*\s)/

export function foldLines(s, n, iN, foldAny, a) {
  a = a || []
  iN = iN || 0
  const i = a.length ? iN : 0 // first line no indent
  const idt = indent(i)

  if (s.length + i <= n) {
    if (s.length) {
      a.push(idt + s)
    }
    return a
  }

  let line = s.substring(0, n - i + (foldAny ? 0 : 1))
  if (foldAny) { // insert newlines anywhere
    a.push(idt + line)
    return foldLines(s.substring(n - i).trimStart(), n, iN, foldAny, a)
  } else { // attempt to insert newlines after whitespace
    const idx = line.search(lastSpaceRgx)
    let nextIdx = n - i
    if (idx > 0) {
      line = line.substring(0, idx)
      nextIdx = idx
    } else {
      nextIdx = s.indexOf(' ')
      if (nextIdx === -1) {
        nextIdx = s.length
      }
      line = s.substring(0, nextIdx)
    }
    a.push(idt + line)
    return foldLines(s.substring(nextIdx).trimStart(), n, iN, foldAny, a)
  }
}
