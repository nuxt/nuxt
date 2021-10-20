import { promises as fsp, existsSync } from 'fs'
import { parse as parsePath, join } from 'pathe'
import globby from 'globby'
import { findExports } from 'mlly'
import { camelCase } from 'scule'
import { AutoImport } from '@nuxt/kit'
import { filterInPlace } from './utils'

export async function scanForComposables (dir: string, autoImports: AutoImport[]) {
  if (!existsSync(dir)) { return }

  const files = await globby(['*.{ts,js,tsx,jsx,mjs,cjs,mts,cts}'], { cwd: dir })

  await Promise.all(
    files.map(async (file) => {
      const importPath = join(dir, file)

      // Remove original entries from the same import (for build watcher)
      filterInPlace(autoImports, i => i.from !== importPath)

      const code = await fsp.readFile(join(dir, file), 'utf-8')
      const exports = findExports(code)
      const defaultExport = exports.find(i => i.type === 'default')

      if (defaultExport) {
        autoImports.push({ name: 'default', as: camelCase(parsePath(file).name), from: importPath })
      }
      for (const exp of exports) {
        if (exp.type === 'named') {
          for (const name of exp.names) {
            autoImports.push({ name, as: name, from: importPath })
          }
        } else if (exp.type === 'declaration') {
          autoImports.push({ name: exp.name, as: exp.name, from: importPath })
        }
      }
    })
  )
}
