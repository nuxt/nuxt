import { promises as fsp, existsSync } from 'fs'
import { parse as parsePath } from 'pathe'
import { findExports } from 'mlly'
import { camelCase } from 'scule'
import { AutoImport } from '@nuxt/schema'
import { resolveFiles } from '@nuxt/kit'
import { filterInPlace } from './utils'

export async function scanForComposables (dir: string, autoImports: AutoImport[]) {
  if (!existsSync(dir)) { return }

  const files = await resolveFiles(dir, [
    '*.{ts,js,mjs,cjs,mts,cts}',
    '*/index.{ts,js,mjs,cjs,mts,cts}'
  ])

  await Promise.all(
    files.map(async (path) => {
      // Remove original entries from the same import (for build watcher)
      filterInPlace(autoImports, i => i.from !== path)

      const code = await fsp.readFile(path, 'utf-8')
      const exports = findExports(code)
      const defaultExport = exports.find(i => i.type === 'default')

      if (defaultExport) {
        let name = parsePath(path).name
        if (name === 'index') {
          name = parsePath(path.split('/').slice(0, -1).join('/')).name
        }
        autoImports.push({ name: 'default', as: camelCase(name), from: path })
      }
      for (const exp of exports) {
        if (exp.type === 'named') {
          for (const name of exp.names) {
            autoImports.push({ name, as: name, from: path })
          }
        } else if (exp.type === 'declaration') {
          autoImports.push({ name: exp.name, as: exp.name, from: path })
        }
      }
    })
  )
}
