import { resolve } from 'path'
import zlib from 'zlib'
import fs from 'fs-extra'
import pify from 'pify'

const gzipCompressor = pify(zlib.gzip)
const brotliCompressor = pify(zlib.brotliCompress)
const compressSize = (input, compressor) => compressor(input).then(data => data.length)

export const getResourcesSize = async (distDir, mode, { filter, gzip, brotli } = {}) => {
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

    if (gzip || brotli) {
      const fileContent = await fs.readFile(file)

      if (gzip) {
        sizes.gzip += await compressSize(fileContent, gzipCompressor) / 1024
      }
      if (brotli) {
        sizes.brotli += await compressSize(fileContent, brotliCompressor) / 1024
      }
    }
  }
  return sizes
}
