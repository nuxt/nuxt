import { readdir } from 'fs/promises'
import { resolve } from 'upath'
import { build } from './build'

async function main () {
  const pkgsDir = resolve(__dirname, '../packages')
  const pkgs = await readdir(pkgsDir)

  const stub = process.argv.includes('--stub')

  for (const pkg of pkgs) {
    const rootDir = resolve(pkgsDir, pkg)
    process.chdir(rootDir)
    await build(rootDir, stub)
  }
}

main().catch(console.error)
