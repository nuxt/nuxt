
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import destr from 'destr'
import { findup } from './fs'

export function createGetDepVersion (rootDir: string) {
  const { dependencies = {}, devDependencies = {} } = findPackage(rootDir)
  return (name: string) => getPkg(name, rootDir)?.version || dependencies[name] || devDependencies[name]
}

export function getPkg (name: string, rootDir: string) {
  // Assume it is in {rootDir}/node_modules/${name}/package.json
  let pkgPath = resolve(rootDir, 'node_modules', name, 'package.json')

  // Try to resolve for more accuracy
  const _require = createRequire(rootDir)
  try { pkgPath = _require.resolve(name + '/package.json') } catch (_err) {
    // console.log('not found:', name)
  }

  return readJSONSync(pkgPath)
}

function findPackage (rootDir: string) {
  return findup(rootDir, (dir) => {
    const p = resolve(dir, 'package.json')
    if (existsSync(p)) {
      return readJSONSync(p)
    }
  }) || {}
}

function readJSONSync (filePath: string) {
  try {
    return destr(readFileSync(filePath, 'utf-8'))
  } catch (err) {
    // TODO: Warn error
    return null
  }
}
