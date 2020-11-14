import { resolve, dirname, relative } from 'path'
import globby from 'globby'
import prettyBytes from 'pretty-bytes'
import gzipSize from 'gzip-size'
import { readFile } from 'fs-extra'
import chalk from 'chalk'

export async function printFSTree (dir) {
  const files = await globby('**/*.js', { cwd: dir })

  const items = (await Promise.all(files.map(async (file) => {
    const path = resolve(dir, file)
    const src = await readFile(path)
    const size = src.byteLength
    const gzip = await gzipSize(src)
    return { file, path, size, gzip }
  }))).sort((a, b) => b.size - a.size)

  let totalSize = 0
  let totalGzip = 0

  items.forEach((item, index) => {
    let dir = dirname(item.file)
    if (dir === '.') { dir = '' }
    const rpath = relative(process.cwd(), item.path)
    const treeChar = index === items.length - 1 ? '└─' : '├─'
    process.stdout.write(chalk.gray(`  ${treeChar} ${rpath} (${prettyBytes(item.size)}) (${prettyBytes(item.gzip)} gzip)\n`))

    totalSize += item.size
    totalGzip += item.gzip
  })

  process.stdout.write(`${chalk.cyan('λ Total size:')} ${prettyBytes(totalSize)} (${prettyBytes(totalGzip)} gzip)\n`)
}
