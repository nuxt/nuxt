import { relative } from 'path'
import jiti from 'jiti'

export const hl = str => '`' + str + '`'

export const prettyPath = (p, highlight = true) => {
  p = relative(process.cwd(), p)
  return highlight ? hl(p) : p
}

export const tryImport = (dir, path) => { try { return jiti(dir)(path) } catch (_err) { } }
