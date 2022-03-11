import { promises as fsp, existsSync } from 'fs'
import { parse as parsePath } from 'pathe'
import { findExports } from 'mlly'
import { camelCase } from 'scule'
import { resolveFiles } from '@nuxt/kit'
import { Unimport } from 'unimport'

export async function scanForComposables (dir: string | string[], ctx: Unimport) {
  const performScan = async (entry: string) => {
    const files = await resolveFiles(entry, [
      '*.{ts,js,mjs,cjs,mts,cts}',
      '*/index.{ts,js,mjs,cjs,mts,cts}'
    ])

    await ctx.modifyDynamicImports(async (dynamicImports) => {
      await Promise.all(
        files.map(async (path) => {
          // Remove original entries from the same import (for build watcher)
          filterInPlace(dynamicImports, i => i.from !== path)

          const code = await fsp.readFile(path, 'utf-8')
          const exports = findExports(code)
          const defaultExport = exports.find(i => i.type === 'default')

          if (defaultExport) {
            let name = parsePath(path).name
            if (name === 'index') {
              name = parsePath(path.split('/').slice(0, -1).join('/')).name
            }
            dynamicImports.push({ name: 'default', as: camelCase(name), from: path })
          }
          for (const exp of exports) {
            if (exp.type === 'named') {
              for (const name of exp.names) {
                dynamicImports.push({ name, as: name, from: path })
              }
            } else if (exp.type === 'declaration') {
              dynamicImports.push({ name: exp.name, as: exp.name, from: path })
            }
          }
        })
      )
    })
  }

  for (const entry of Array.isArray(dir) ? dir : [dir]) {
    if (!existsSync(entry)) { continue }

    await performScan(entry)
  }
}

function filterInPlace<T> (arr: T[], predicate: (v: T) => any) {
  let i = arr.length
  while (i--) {
    if (!predicate(arr[i])) {
      arr.splice(i, 1)
    }
  }
}
