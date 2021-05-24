export default {
  build: true,
  ignoreUnused: [
    'crc', 'compression', 'connect', 'destr', 'fs-extra',
    'globby', 'opener', 'pretty-bytes', 'serve-static', 'upath', 'lodash'
  ],
  externals: ['crc/lib/crc32']
}
