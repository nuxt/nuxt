import { resolve } from 'path'
import zlib from 'zlib'
import fs from 'fs-extra'
import pify from 'pify'

const gzip = pify(zlib.gzip)
const brotli = pify(zlib.brotliCompress)
const compressSize = (input, compressor) => compressor(input).then(data => data.length)

export const getResourcesSize = async (distDir, mode, filter) => {
  if (!filter) {
    filter = filename => filename.endsWith('.js')
  }
  const { all } = await import(resolve(distDir, 'server', `${mode}.manifest.json`))
  const resources = all.filter(filter)
  const sizes = { uncompressed: 0, gzip: 0, brotli: 0 }
  for (const resource of resources) {
    const file = resolve(distDir, 'client', resource)
    const stat = await fs.stat(file)
    sizes.uncompressed += stat.size / 1024
    const fileContent = await fs.readFile(file)
    sizes.gzip += await compressSize(fileContent, gzip) / 1024
    sizes.brotli += await compressSize(fileContent, brotli) / 1024
  }
  return sizes
}
