import path from 'path'
import consola from 'consola'
import execa from 'execa'
import fs from 'fs-extra'
import _glob from 'glob'
import pify from 'pify'

const glob = pify(_glob) // TODO: use globby

async function main () {
  const packageDirs = await glob('+(packages|distributions)/*')

  const packages = packageDirs.map(pkgDir => ({
    dir: pkgDir,
    pkg: fs.readJSONSync(path.join(pkgDir, 'package.json'))
  }))

  const packageNames = packages.map(p => p.pkg.name).join(' ')

  consola.info(`Linking ${packages.length} packages...`)

  await Promise.all(packages.map(pkg => execa('yarn', ['link'], { cwd: pkg.dir })))

  consola.log(`Link: \nyarn link ${packageNames}\n`)
  consola.log(`Unlink: \nyarn unlink ${packageNames}\n`)
}

main().catch(consola.error)
