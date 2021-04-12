import { readFile, stat } from 'fs/promises'
import type { Plugin } from 'rollup'
import createEtag from 'etag'
import mime from 'mime'
import { resolve } from 'upath'
import globby from 'globby'
import virtual from './virtual'

export interface AssetOptions {
  inline: Boolean
  dirs: {
    [assetdir: string]: {
      dir: string
      meta?: boolean
    }
  }
}

export function assets (opts: AssetOptions): Plugin {
  type Asset = {
    fsPath: string,
    meta: {
      type?: string,
      etag?: string,
      mtime?: string
    }
  }

  const assetUtils = `
export function readAsset (id) {
  return getAsset(id).read()
}

export function statAsset (id) {
  return getAsset(id).meta
}
`

  if (!opts.inline) {
    return virtual({
      '~nitro/assets': `
import { statSync, promises as fsp } from 'fs'
import { resolve } from 'path'

const dirs = ${JSON.stringify(opts.dirs)}

${assetUtils}

export function getAsset (id) {
  for (const dirname in dirs) {
    if (id.startsWith(dirname + '/')) {
      const dirOpts = dirs[dirname]
      const path = resolve(dirOpts.dir, id.substr(dirname.length + 1))
      let stat = statSync(path)
      const asset = {
        read: () => fsp.readFile(path, 'utf-8'),
        meta: {
          mtime: stat.mtime
        }
      }
      return asset
    }
  }
  throw new Error('Asset dir not found: ' + id)
}
      `
    })
  }

  return virtual({
    '~nitro/assets': {
      async load () {
        const assets: Record<string, Asset> = {}
        for (const assetdir in opts.dirs) {
          const dirOpts = opts.dirs[assetdir]
          const files = globby.sync('**/*.*', { cwd: dirOpts.dir, absolute: false })
          for (const _id of files) {
            const fsPath = resolve(dirOpts.dir, _id)
            const id = assetdir + '/' + _id
            assets[id] = { fsPath, meta: {} }
            if (dirOpts.meta) {
              let type = mime.getType(id) || 'text/plain'
              if (type.startsWith('text')) { type += '; charset=utf-8' }
              const etag = createEtag(await readFile(fsPath))
              const mtime = await stat(fsPath).then(s => s.mtime.toJSON())
              assets[id].meta = { type, etag, mtime }
            }
          }
        }
        const inlineAssets = `const assets = {\n${Object.keys(assets).map(id =>
          `  ['${id}']: {\n    read: () => import('${assets[id].fsPath}'),\n    meta: ${JSON.stringify(assets[id].meta)}\n  }`
        ).join(',\n')}\n}`
        return `${inlineAssets}\n${assetUtils}
export function getAsset (id) {
  if (!assets[id]) {
    throw new Error('Asset not found : ' + id)
  }
  return assets[id]
}`
      }
    }
  })
}
