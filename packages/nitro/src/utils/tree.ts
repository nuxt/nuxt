import { promises as fsp } from 'fs'
import { resolve, dirname, relative } from 'pathe'
import globby from 'globby'
import prettyBytes from 'pretty-bytes'
import { gzipSize } from 'gzip-size'
import chalk from 'chalk'
import { isTest } from 'std-env'

export async function printFSTree (dir: string) {
  if (isTest) {
    return
  }

  const files = await globby('**/*.*', { cwd: dir })

  const items = (await Promise.all(files.map(async (file) => {
    const path = resolve(dir, file)
    const src = await fsp.readFile(path)
    const size = src.byteLength
    const gzip = await gzipSize(src)
    return { file, path, size, gzip }
  }))).sort((a, b) => b.path.localeCompare(a.path))

  let totalSize = 0
  let totalGzip = 0

  let totalNodeModulesSize = 0
  let totalNodeModulesGzip = 0

  items.forEach((item, index) => {
    let dir = dirname(item.file)
    if (dir === '.') { dir = '' }
    const rpath = relative(process.cwd(), item.path)
    const treeChar = index === items.length - 1 ? '└─' : '├─'

    const isNodeModules = item.file.includes('node_modules')

    if (isNodeModules) {
      totalNodeModulesSize += item.size
      totalNodeModulesGzip += item.gzip
      return
    }

    process.stdout.write(chalk.gray(`  ${treeChar} ${rpath} (${prettyBytes(item.size)}) (${prettyBytes(item.gzip)} gzip)\n`))
    totalSize += item.size
    totalGzip += item.gzip
  })

  process.stdout.write(`${chalk.cyan('Σ Total size:')} ${prettyBytes(totalSize + totalNodeModulesSize)} (${prettyBytes(totalGzip + totalNodeModulesGzip)} gzip)\n`)
}
