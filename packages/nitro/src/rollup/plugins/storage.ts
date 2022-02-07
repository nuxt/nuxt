import virtual from '@rollup/plugin-virtual'
import { genImport, genString } from 'knitwork'
import { serializeImportName } from '../../utils'

export interface StorageOptions {
  mounts: {
    [path: string]: {
      driver: 'fs' | 'http' | 'memory',
      driverOptions?: Record<string, any>
    }
  }
}

const drivers = {
  fs: 'unstorage/drivers/fs',
  http: 'unstorage/drivers/http',
  memory: 'unstorage/drivers/memory'
}

export function storage (opts: StorageOptions) {
  const mounts: { path: string, driver: string, opts: object }[] = []

  for (const path in opts.mounts) {
    const mount = opts.mounts[path]
    mounts.push({
      path,
      driver: drivers[mount.driver] || mount.driver,
      opts: mount.driverOptions || {}
    })
  }

  const driverImports = Array.from(new Set(mounts.map(m => m.driver)))

  return virtual({
    '#storage': `
import { createStorage } from 'unstorage'
import { assets } from '#assets'

${driverImports.map(i => genImport(i, serializeImportName(i))).join('\n')}

export const storage = createStorage({})

storage.mount('/assets', assets)

${mounts.map(m => `storage.mount(${genString(m.path)}, ${serializeImportName(m.driver)}(${JSON.stringify(m.opts)}))`).join('\n')}
`
  })
}
