import { relative, dirname } from 'path'
import { readFile, writeFile, mkdirp } from 'fs-extra'
import jiti from 'jiti'

const pwd = process.cwd()

export const hl = str => '`' + str + '`'

export function prettyPath (p, highlight = true) {
  p = relative(pwd, p)
  return highlight ? hl(p) : p
}

export async function loadTemplate (src) {
  const contents = await readFile(src, 'utf-8')
  return params => contents.replace(/{{ (\w+) }}/g, `${params.$1}`)
}

export async function renderTemplate (src, dst: string, params: any) {
  const tmpl = await loadTemplate(src)
  const rendered = tmpl(params)
  await mkdirp(dirname(dst))
  await writeFile(dst, rendered)
}

export async function compileTemplateToJS (src: string, dst: string) {
  const contents = await readFile(src, 'utf-8')
  // eslint-disable-next-line no-template-curly-in-string
  const compiled = `export default (params) => \`${contents.replace(/{{ (\w+) }}/g, '${params.$1}')}\``
  await mkdirp(dirname(dst))
  await writeFile(dst, compiled)
}

export const tryImport = (dir, path) => { try { return jiti(dir)(path) } catch (_err) { } }
