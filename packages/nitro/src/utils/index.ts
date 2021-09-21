import { relative, dirname, resolve } from 'upath'
import fse from 'fs-extra'
import jiti from 'jiti'
import defu from 'defu'
import { mergeHooks } from 'hookable'
import consola from 'consola'
import chalk from 'chalk'
import { get } from 'dot-prop'
import type { NitroPreset, NitroInput } from '../context'

export const MODULE_DIR = resolve(__dirname, '..')

export function hl (str: string) {
  return chalk.cyan(str)
}

export function prettyPath (p: string, highlight = true) {
  p = relative(process.cwd(), p)
  return highlight ? hl(p) : p
}

export function compileTemplate (contents: string) {
  return (params: Record<string, any>) => contents.replace(/{{ ?([\w.]+) ?}}/g, (_, match) => {
    const val = get(params, match)
    if (!val) {
      consola.warn(`cannot resolve template param '${match}' in ${contents.substr(0, 20)}`)
    }
    return val as string || `${match}`
  })
}

export function serializeTemplate (contents: string) {
  // eslint-disable-next-line no-template-curly-in-string
  return `(params) => \`${contents.replace(/{{ (\w+) }}/g, '${params.$1}')}\``
}

export function jitiImport (dir: string, path: string) {
  return jiti(dir)(path)
}

export function tryImport (dir: string, path: string) {
  try {
    return jitiImport(dir, path)
  } catch (_err) { }
}

export async function writeFile (file: string, contents: string, log = false) {
  await fse.mkdirp(dirname(file))
  await fse.writeFile(file, contents, 'utf-8')
  if (log) {
    consola.info('Generated', prettyPath(file))
  }
}

export function resolvePath (nitroContext: NitroInput, path: string | ((nitroContext: NitroInput) => string), resolveBase: string = ''): string {
  if (typeof path === 'function') {
    path = path(nitroContext)
  }

  if (typeof path !== 'string') {
    throw new TypeError('Invalid path: ' + path)
  }

  path = compileTemplate(path)(nitroContext)

  return resolve(resolveBase, path)
}

export function detectTarget () {
  if (process.env.NETLIFY || process.env.NETLIFY_LOCAL) {
    return 'netlify'
  }

  if (process.env.NOW_BUILDER) {
    return 'vercel'
  }

  if (process.env.INPUT_AZURE_STATIC_WEB_APPS_API_TOKEN) {
    return 'azure'
  }
}

export async function isDirectory (path: string) {
  try {
    return (await fse.stat(path)).isDirectory()
  } catch (_err) {
    return false
  }
}

export function extendPreset (base: NitroPreset, preset: NitroPreset): NitroPreset {
  return (config: NitroInput) => {
    if (typeof preset === 'function') {
      preset = preset(config)
    }
    if (typeof base === 'function') {
      base = base(config)
    }
    return defu({
      hooks: mergeHooks(base.hooks, preset.hooks)
    }, preset, base)
  }
}

const _getDependenciesMode = {
  dev: ['devDependencies'],
  prod: ['dependencies'],
  all: ['devDependencies', 'dependencies']
}
export function getDependencies (dir: string, mode: keyof typeof _getDependenciesMode = 'all') {
  const fields = _getDependenciesMode[mode]
  const pkg = require(resolve(dir, 'package.json'))
  const dependencies = []
  for (const field of fields) {
    if (pkg[field]) {
      for (const name in pkg[field]) {
        dependencies.push(name)
      }
    }
  }
  return dependencies
}

// TODO: Refactor to scule (https://github.com/unjs/scule/issues/6)
export function serializeImportName (id: string) {
  return '_' + id.replace(/[^a-zA-Z0-9_$]/g, '_')
}
