import { relative, dirname, resolve } from 'path'
import { readFile, writeFile, mkdirp } from 'fs-extra'
import jiti from 'jiti'
import { SLSOptions, UnresolvedPath } from './config'

const pwd = process.cwd()

export const hl = (str: string) => '`' + str + '`'

export function prettyPath (p: string, highlight = true) {
  p = relative(pwd, p)
  return highlight ? hl(p) : p
}

export async function loadTemplate (src: string) {
  const contents = await readFile(src, 'utf-8')
  return (params: Record<string, string>) => contents.replace(/{{ (\w+) }}/g, `${params.$1}`)
}

export async function renderTemplate (src: string, dst: string, params: any) {
  const tmpl = await loadTemplate(src)
  const rendered = tmpl(params)
  await mkdirp(dirname(dst))
  await writeFile(dst, rendered)
}

export async function compileTemplateToJS (src: string) {
  const contents = await readFile(src, 'utf-8')
  // eslint-disable-next-line no-template-curly-in-string
  return `export default (params) => \`${contents.replace(/{{ (\w+) }}/g, '${params.$1}')}\``
}

export async function writeFileP (path, contents) {
  await mkdirp(dirname(path))
  await writeFile(path, contents)
}

export const jitiImport = (dir: string, path: string) => jiti(dir)(path)
export const tryImport = (dir: string, path: string) => { try { return jitiImport(dir, path) } catch (_err) { } }

export function resolvePath (options: SLSOptions, path: UnresolvedPath, resolveBase: string = '') {
  return resolve(resolveBase, typeof path === 'string' ? path : path(options))
}

export function detectTarget () {
  if (process.env.NETLIFY) {
    return 'netlify'
  }

  if (process.env.VERCEL_URL) {
    return 'vercel'
  }

  return 'node'
}

export const LIB_DIR = resolve(__dirname, '../lib')
export const RUNTIME_DIR = resolve(LIB_DIR, 'runtime')
