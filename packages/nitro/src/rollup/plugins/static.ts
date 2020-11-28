import createEtag from 'etag'
import { readFileSync, statSync } from 'fs-extra'
import mime from 'mime'
import { relative, resolve } from 'upath'
import virtual from '@rollup/plugin-virtual'
import globby from 'globby'
import type { SigmaContext } from '../../context'

export function staticAssets (context: SigmaContext) {
  const assets: Record<string, { type: string, etag: string, mtime: string, path: string }> = {}

  const files = globby.sync('**/*.*', { cwd: context.output.publicDir, absolute: false })

  for (const id of files) {
    let type = mime.getType(id) || 'text/plain'
    if (type.startsWith('text')) { type += '; charset=utf-8' }
    const fullPath = resolve(context.output.publicDir, id)
    const etag = createEtag(readFileSync(fullPath))
    const stat = statSync(fullPath)

    assets[id] = {
      type,
      etag,
      mtime: stat.mtime.toJSON(),
      path: relative(context.output.serverDir, fullPath)
    }
  }

  return virtual({
    '~static-assets': `export default ${JSON.stringify(assets, null, 2)};`,
    '~static': `
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import assets from '~static-assets'

const mainDir = dirname(require.main.filename)

export function readAsset (id) {
  return readFile(resolve(mainDir, getAsset(id).path))
}

export function getAsset (id) {
  return assets[id]
}
`
  })
}
