import { basename, resolve, dirname } from 'path'
import globby, { GlobbyOptions } from 'globby'
import { copyFile, mkdirp } from 'fs-extra'

const PLUGIN_NAME = 'dynamic-require'
const HELPER_DYNAMIC = `\0${PLUGIN_NAME}.js`
const DYNAMIC_REQUIRE_RE = /require\("\.\/" ?\+/g

const TMPL_INLINE = ({ imports }) =>
  `${imports.map(i => `import ${i.name} from '${i.import}'`).join('\n')}
const dynamicChunks = {
  ${imports.map(i => ` ['${i.id}']: ${i.name}`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id];
};`

const TMPL_CJS = ({ chunksDir }) => `export default function dynamicRequire(id) {
return require('./${chunksDir}/' + id);
};`

interface Options {
  dir: string
  globbyOptions: GlobbyOptions
  outDir?: string
  chunksDir?: string
}

export default function dynamicRequire ({ dir, globbyOptions, outDir, chunksDir }: Options) {
  return {
    name: PLUGIN_NAME,
    transform (code, _id) {
      return code.replace(DYNAMIC_REQUIRE_RE, `require('${HELPER_DYNAMIC}')(`)
    },
    resolveId (id) {
      return id === HELPER_DYNAMIC ? id : null
    },
    async load (id) {
      if (id === HELPER_DYNAMIC) {
        const files = await globby('**/*.js', { cwd: dir, absolute: false, ...globbyOptions })

        const imports = files.map(id => ({
          id,
          import: resolve(dir, id),
          name: id.replace(/[\\/.]/g, '_')
        }))

        if (!outDir) {
          return TMPL_INLINE({ imports })
        }

        // Write chunks
        chunksDir = chunksDir || basename(dir)
        await Promise.all(imports.map(async (i) => {
          const dst = resolve(outDir, chunksDir, i.id)
          await mkdirp(dirname(dst))
          await copyFile(i.import, dst)
        }))
        return TMPL_CJS({ chunksDir })
      }
      return null
    }
  }
}
