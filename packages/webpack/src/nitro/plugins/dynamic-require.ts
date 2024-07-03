import { globby } from 'globby'
import { genSafeVariableName } from 'knitwork'
import { resolve } from 'pathe'
import type { Plugin } from 'rollup'
import { importModule } from '@nuxt/kit'

const PLUGIN_NAME = 'dynamic-require'
const HELPER_DYNAMIC = `\0${PLUGIN_NAME}.mjs`
const DYNAMIC_REQUIRE_RE = /import\("\.\/" ?\+(.*)\).then/g

interface Options {
  dir: string
  inline: boolean
  ignore: string[]
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

export function dynamicRequire ({ dir, ignore, inline }: Options): Plugin {
  return {
    name: PLUGIN_NAME,
    transform (code: string, _id: string) {
      return {
        code: code.replace(
          DYNAMIC_REQUIRE_RE,
          `import('${HELPER_DYNAMIC}').then(r => r.default || r).then(dynamicRequire => dynamicRequire($1)).then`,
        ),
        map: null,
      }
    },
    resolveId (id: string) {
      return id === HELPER_DYNAMIC ? id : null
    },
    // TODO: Async chunk loading over network!
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
      let files = []
      try {
        const wpManifest = resolve(dir, './server.manifest.json')
        files = await importModule<{ files: Record<string, unknown> }>(wpManifest)
          .then(r => Object.keys(r.files).filter(file => !ignore.includes(file)))
      } catch {
        files = await globby('**/*.{cjs,mjs,js}', {
          cwd: dir,
          absolute: false,
          ignore,
        })
      }

      const chunks = (
        await Promise.all(
          files.map(async id => ({
            id,
            src: resolve(dir, id).replace(/\\/g, '/'),
            name: genSafeVariableName(id),
            meta: await getWebpackChunkMeta(resolve(dir, id)),
          })),
        )
      ).filter(chunk => chunk.meta) as Chunk[]

      return inline ? TMPL_INLINE({ chunks }) : TMPL_LAZY({ chunks })
    },
  }
}

async function getWebpackChunkMeta (src: string) {
  const chunk = await importModule<{ id: string, ids: string[], modules: Record<string, unknown> }>(src) || {}
  const { id, ids, modules } = chunk
  if (!id && !ids) {
    return null // Not a webpack chunk
  }
  return {
    id,
    ids,
    moduleIds: Object.keys(modules || {}),
  }
}

function TMPL_INLINE ({ chunks }: TemplateContext) {
  return `${chunks
    .map(i => `import * as ${i.name} from '${i.src}'`)
    .join('\n')}
const dynamicChunks = {
  ${chunks.map(i => ` ['${i.id}']: ${i.name}`).join(',\n')}
};

export default function dynamicRequire(id) {
  return Promise.resolve(dynamicChunks[id]);
};`
}

function TMPL_LAZY ({ chunks }: TemplateContext) {
  return `
const dynamicChunks = {
${chunks.map(i => ` ['${i.id}']: () => import('${i.src}')`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id]();
};`
}
