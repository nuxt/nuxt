import path from 'path'
import consola from 'consola'
import escapeRegExp from 'lodash/escapeRegExp'

export const startsWithAlias = aliasArray => str => aliasArray.some(c => str.startsWith(c))

export const startsWithSrcAlias = startsWithAlias(['@', '~'])

export const startsWithRootAlias = startsWithAlias(['@@', '~~'])

export const isWindows = process.platform.startsWith('win')

export const wp = function wp (p = '') {
  if (isWindows) {
    return p.replace(/\\/g, '\\\\')
  }
  return p
}

// Kept for backward compat (modules may use it from template context)
export const wChunk = function wChunk (p = '') {
  return p
}

const reqSep = /\//g
const sysSep = escapeRegExp(path.sep)
const normalize = string => string.replace(reqSep, sysSep)

export const r = function r (...args) {
  const lastArg = args[args.length - 1]

  if (startsWithSrcAlias(lastArg)) {
    return wp(lastArg)
  }

  return wp(path.resolve(...args.map(normalize)))
}

export const relativeTo = function relativeTo (...args) {
  const dir = args.shift()

  // Keep webpack inline loader intact
  if (args[0].includes('!')) {
    const loaders = args.shift().split('!')

    return loaders.concat(relativeTo(dir, loaders.pop(), ...args)).join('!')
  }

  // Resolve path
  const resolvedPath = r(...args)

  // Check if path is an alias
  if (startsWithSrcAlias(resolvedPath)) {
    return resolvedPath
  }

  // Make correct relative path
  let rp = path.relative(dir, resolvedPath)
  if (rp[0] !== '.') {
    rp = '.' + path.sep + rp
  }

  return wp(rp)
}

export function defineAlias (src, target, prop, opts = {}) {
  const { bind = true, warn = false } = opts

  if (Array.isArray(prop)) {
    for (const p of prop) {
      defineAlias(src, target, p, opts)
    }
    return
  }

  let targetVal = target[prop]
  if (bind && typeof targetVal === 'function') {
    targetVal = targetVal.bind(target)
  }

  let warned = false

  Object.defineProperty(src, prop, {
    get: () => {
      if (warn && !warned) {
        warned = true
        consola.warn({
          message: `'${prop}' is deprecated'`,
          additional: new Error().stack.split('\n').splice(2).join('\n')
        })
      }
      return targetVal
    }
  })
}

const isIndex = s => /(.*)\/index\.[^/]+$/.test(s)

export function isIndexFileAndFolder (pluginFiles) {
  // Return early in case the matching file count exceeds 2 (index.js + folder)
  if (pluginFiles.length !== 2) {
    return false
  }
  return pluginFiles.some(isIndex)
}

export const getMainModule = () => {
  return require.main || (module && module.main) || module
}
