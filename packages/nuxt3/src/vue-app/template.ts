import path from 'path'
import globby from 'globby'

const dir = path.join(__dirname, 'nuxt')
const files = globby.sync(path.join(dir, '/**'))
  .map(f => f.replace(dir + path.sep, '')) // TODO: workaround

export default {
  dependencies: {},
  dir,
  files
}
