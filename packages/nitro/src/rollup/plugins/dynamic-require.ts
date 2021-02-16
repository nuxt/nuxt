import { resolve } from 'upath'
import globby, { GlobbyOptions } from 'globby'
import type { Plugin } from 'rollup'

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
  id: string
  src: string
  name: string
  meta?: {
    id?: string
    ids?: string[]
    moduleIds?: string[]
  }
}

interface TemplateContext {
  chunks: Chunk[]
}

export function dynamicRequire ({ dir, globbyOptions, inline }: Options): Plugin {
  return {
    name: PLUGIN_NAME,
    transform (code: string, _id: string) {
      return {
        code: code.replace(DYNAMIC_REQUIRE_RE, `require('${HELPER_DYNAMIC}')(`),
        map: null
      }
    },
    resolveId (id: string) {
      return id === HELPER_DYNAMIC ? id : null
    },
    // TODO: Async chunk loading over netwrok!
    // renderDynamicImport () {
    //   return {
    //     left: 'fetch(', right: ')'
    //   }
    // },
    async load (_id: string) {
      if (_id !== HELPER_DYNAMIC) {
        return null
      }

      // Scan chunks
      const files = await globby('**/*.js', { cwd: dir, absolute: false, ...globbyOptions })
      const chunks = files.map(id => ({
        id,
        src: resolve(dir, id).replace(/\\/g, '/'),
        name: '_' + id.replace(/[^a-zA-Z_]/g, '_'),
        meta: getWebpackChunkMeta(resolve(dir, id))
      }))

      return inline ? TMPL_INLINE({ chunks }) : TMPL_LAZY({ chunks })
    },
    renderChunk (code) {
      if (inline) {
        return {
          map: null,
          code
        }
      }
      return {
        map: null,
        code: code.replace(
          /Promise.resolve\(\).then\(function \(\) \{ return require\('([^']*)' \/\* webpackChunk \*\/\); \}\).then\(function \(n\) \{ return n.([_a-zA-Z0-9]*); \}\)/g,
          "require('$1').$2")
      }
    }
  }
}

function getWebpackChunkMeta (src: string) {
  const chunk = require(src) || {}
  const { id, ids, modules } = chunk
  return {
    id,
    ids,
    moduleIds: Object.keys(modules)
  }
}

function TMPL_INLINE ({ chunks }: TemplateContext) {
  return `${chunks.map(i => `import ${i.name} from '${i.src}'`).join('\n')}
const dynamicChunks = {
  ${chunks.map(i => ` ['${i.id}']: ${i.name}`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id];
};`
}

function TMPL_LAZY ({ chunks }: TemplateContext) {
  return `
function dynamicWebpackModule(id, getChunk) {
  return function (module, exports, require) {
    const r = getChunk()
    if (r instanceof Promise) {
      module.exports = r.then(r => {
        const realModule = { exports: {}, require };
        r.modules[id](realModule, realModule.exports, realModule.require);
        return realModule.exports;
      });
    } else {
      r.modules[id](module, exports, require);
    }
  };
};

function webpackChunk (meta, getChunk) {
 const chunk = { ...meta, modules: {} };
 for (const id of meta.moduleIds) {
   chunk.modules[id] = dynamicWebpackModule(id, getChunk);
 };
 return chunk;
};

const dynamicChunks = {
${chunks.map(i => ` ['${i.id}']: () => webpackChunk(${JSON.stringify(i.meta)}, () => import('${i.src}' /* webpackChunk */))`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id]();
};`
}
