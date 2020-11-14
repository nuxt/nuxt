import { resolve, dirname } from 'path'
import globby, { GlobbyOptions } from 'globby'
import { copyFile, mkdirp } from 'fs-extra'

const PLUGIN_NAME = 'dynamic-require'
const HELPER_DYNAMIC = `\0${PLUGIN_NAME}.js`
const DYNAMIC_REQUIRE_RE = /require\("\.\/" ?\+/g

interface Options {
  dir: string
  inline: boolean
  globbyOptions: GlobbyOptions
  outDir?: string
  prefix?: string
}

interface Chunk {
  name: string
  id: string
  src: string
}

interface TemplateContext {
  chunks: Chunk[]
  prefix: string
}

export function dynamicRequire ({ dir, globbyOptions, inline, outDir, prefix = '' }: Options) {
  return {
    name: PLUGIN_NAME,
    transform (code: string, _id: string) {
      return code.replace(DYNAMIC_REQUIRE_RE, `require('${HELPER_DYNAMIC}')(`)
    },
    resolveId (id: string) {
      return id === HELPER_DYNAMIC ? id : null
    },
    async load (_id: string) {
      if (_id !== HELPER_DYNAMIC) {
        return null
      }

      // Scan chunks
      const files = await globby('**/*.js', { cwd: dir, absolute: false, ...globbyOptions })
      const chunks = files.map(id => ({
        id,
        src: resolve(dir, id).replace(/\\/g, '/'),
        out: prefix + id,
        name: '_' + id.replace(/[\\/.]/g, '_')
      }))

      // Inline mode
      if (inline) {
        return TMPL_ESM_INLINE({ chunks, prefix })
      }

      // Write chunks
      await Promise.all(chunks.map(async (chunk) => {
        const dst = resolve(outDir, prefix + chunk.id)
        await mkdirp(dirname(dst))
        await copyFile(chunk.src, dst)
      }))

      return TMPL_CJS_LAZY({ chunks, prefix })
    }
  }
}

function TMPL_ESM_INLINE ({ chunks }: TemplateContext) {
  return `${chunks.map(i => `import ${i.name} from '${i.src}'`).join('\n')}
const dynamicChunks = {
  ${chunks.map(i => ` ['${i.id}']: ${i.name}`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id];
};`
}

function TMPL_CJS_LAZY ({ chunks, prefix }: TemplateContext) {
  return `const dynamicChunks = {
${chunks.map(i => ` ['${i.id}']: () => require('${prefix}${i.id}')`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id]();
};`
}

// function TMPL_CJS ({ prefix }: TemplateContext) {
//   return `export default function dynamicRequire(id) {
// return require('${prefix}' + id);
// };`
// }
