import path from 'path'
import { existsSync } from 'fs'
import consola from 'consola'
import esm from 'esm'
import wrapAnsi from 'wrap-ansi'

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

export function indentLines(string, spaces, firstLineSpaces) {
  const lines = Array.isArray(string) ? string : string.split('\n')
  let s = ''
  if (lines.length) {
    const i0 = indent(firstLineSpaces === undefined ? spaces : firstLineSpaces)
    s = i0 + lines.shift()
  }
  if (lines.length) {
    const i = indent(spaces)
    s += '\n' + lines.map(l => i + l.trim()).join('\n')
  }
  return s
}

export function foldLines(string, maxCharsPerLine, spaces, firstLineSpaces) {
  return indentLines(wrapAnsi(string, maxCharsPerLine), spaces, firstLineSpaces)
}
