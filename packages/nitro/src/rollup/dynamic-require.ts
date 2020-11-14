import { basename, resolve, dirname } from 'path'
import globby, { GlobbyOptions } from 'globby'
import { copyFile, mkdirp } from 'fs-extra'

const PLUGIN_NAME = 'dynamic-require'
const HELPER_DYNAMIC = `\0${PLUGIN_NAME}.js`
const DYNAMIC_REQUIRE_RE = /require\("\.\/" ?\+/g

interface Import {
  name: string
  id: string
  import: string
}

const TMPL_ESM_INLINE = ({ imports }: { imports: Import[]}) =>
  `${imports.map(i => `import ${i.name} from '${i.import.replace(/\\/g, '/')}'`).join('\n')}
const dynamicChunks = {
  ${imports.map(i => ` ['${i.id}']: ${i.name}`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id];
};`

const TMPL_CJS_LAZY = ({ imports, chunksDir }) =>
  `const dynamicChunks = {
${imports.map(i => ` ['${i.id}']: () => require('./${chunksDir}/${i.id}')`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id]();
};`

// const TMPL_CJS = ({ chunksDir }) => `export default function dynamicRequire(id) {
// return require('./${chunksDir}/' + id);
// };`

interface Options {
  dir: string
  globbyOptions: GlobbyOptions
  outDir?: string
  chunksDir?: string
}

export default function dynamicRequire ({ dir, globbyOptions, outDir, chunksDir }: Options) {
  return {
    name: PLUGIN_NAME,
    transform (code: string, _id: string) {
      return code.replace(DYNAMIC_REQUIRE_RE, `require('${HELPER_DYNAMIC}')(`)
    },
    resolveId (id: string) {
      return id === HELPER_DYNAMIC ? id : null
    },
    async load (id: string) {
      if (id === HELPER_DYNAMIC) {
        const files = await globby('**/*.js', { cwd: dir, absolute: false, ...globbyOptions })

        const imports = files.map(id => ({
          id,
          import: resolve(dir, id),
          name: '_' + id.replace(/[\\/.]/g, '_')
        }))

        if (!outDir) {
          return TMPL_ESM_INLINE({ imports })
        }

        // Write chunks
        chunksDir = chunksDir || basename(dir)
        await Promise.all(imports.map(async (i) => {
          const dst = resolve(outDir, chunksDir, i.id)
          await mkdirp(dirname(dst))
          await copyFile(i.import, dst)
        }))
        return TMPL_CJS_LAZY({ chunksDir, imports })
      }
      return null
    }
  }
}
