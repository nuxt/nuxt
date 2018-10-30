import path from 'path'
import { existsSync } from 'fs'
import consola from 'consola'
import esm from 'esm'
import wrapAnsi from 'wrap-ansi'
import defaultsDeep from 'lodash/defaultsDeep'
import { getNuxtConfig } from '@nuxt/config'

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
  options.server = defaultsDeep({
    port: argv.port || undefined,
    host: argv.hostname || undefined,
    socket: argv['unix-socket'] || undefined
  }, options.server || {}, getNuxtConfig().server)

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
    s = i0 + lines.shift().trim()
  }
  if (lines.length) {
    const i = indent(spaces)
    s += '\n' + lines.map(l => i + l.trim()).join('\n')
  }
  return s
}

export function foldLines(string, maxCharsPerLine, spaces, firstLineSpaces) {
  return indentLines(wrapAnsi(string, maxCharsPerLine, { trim: false }), spaces, firstLineSpaces)
}
